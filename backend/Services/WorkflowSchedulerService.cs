using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.Models;
using System.Collections.Concurrent;
using System.Text.Json;

namespace MiniN8N.Api.Services;

public class WorkflowSchedulerService : BackgroundService, IWorkflowSchedulerService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<WorkflowSchedulerService> _logger;
    private readonly ConcurrentDictionary<int, Timer> _timers = new();
    private readonly ConcurrentDictionary<int, bool> _executing = new();

    public WorkflowSchedulerService(IServiceProvider serviceProvider, ILogger<WorkflowSchedulerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Workflow Scheduler Service starting (Startup Loading)...");

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var activeWorkflows = await context.Workflows
                .Include(w => w.Nodes)
                .Where(w => w.IsActive || w.IsTesting)
                .ToListAsync(stoppingToken);

            foreach (var workflow in activeWorkflows)
            {
                ScheduleWorkflow(workflow.Id);
            }

            _logger.LogInformation("Loaded {Count} active workflows into memory scheduler.", activeWorkflows.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading workflows on startup.");
        }

        // Wait until cancellation
        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Workflow Scheduler Service stopping...");
        }
    }

    public void ScheduleWorkflow(int workflowId)
    {
        UnscheduleWorkflow(workflowId);

        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var workflow = context.Workflows.Include(w => w.Nodes).FirstOrDefault(w => w.Id == workflowId);

        if (workflow == null || (!workflow.IsActive && !workflow.IsTesting)) return;

        var scheduleNode = workflow.Nodes.FirstOrDefault(n => n.Category == "schedule");
        if (scheduleNode == null) return;

        var interval = GetInterval(scheduleNode);
        if (interval == TimeSpan.Zero) return;

        // Start timer after 'interval' and tick every 'interval'
        var timer = new Timer(async _ => await TickAsync(workflowId), null, interval, interval);
        _timers.TryAdd(workflowId, timer);
        
        _logger.LogInformation("[TIMER] Scheduled workflow {WorkflowId} every {Interval}", workflowId, interval);
    }

    public void UnscheduleWorkflow(int workflowId)
    {
        if (_timers.TryRemove(workflowId, out var timer))
        {
            timer.Dispose();
            _logger.LogInformation("[TIMER] Unscheduled workflow {WorkflowId}", workflowId);
        }
    }

    public async Task ManualTriggerAsync(int workflowId)
    {
        _logger.LogInformation("[MANUAL] Triggering workflow {WorkflowId} immediately", workflowId);
        await ExecuteWorkflowInternalAsync(workflowId);
    }

    private async Task TickAsync(int workflowId)
    {
        if (_executing.TryGetValue(workflowId, out var isRunning) && isRunning)
        {
            _logger.LogWarning("[TIMER] Workflow {WorkflowId} execution skipped (overlap).", workflowId);
            return;
        }

        await ExecuteWorkflowInternalAsync(workflowId);
    }

    private async Task ExecuteWorkflowInternalAsync(int workflowId)
    {
        if (!_executing.TryAdd(workflowId, true)) return;

        try
        {
            using var scope = _serviceProvider.CreateScope();
            var nodeExecutor = scope.ServiceProvider.GetRequiredService<INodeExecutorService>();
            await nodeExecutor.ExecuteWorkflowAsync(workflowId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error executing workflow {WorkflowId}", workflowId);
        }
        finally
        {
            _executing.TryRemove(workflowId, out _);
        }
    }

    private TimeSpan GetInterval(Node scheduleNode)
    {
        try
        {
            var config = JsonSerializer.Deserialize<JsonElement>(scheduleNode.Object);
            var intervalValue = config.TryGetProperty("intervalValue", out var v) ? v.GetInt32() : 1;
            var intervalUnit = config.TryGetProperty("intervalUnit", out var u) ? u.GetString() : "minutes";

            return intervalUnit switch
            {
                "seconds" => TimeSpan.FromSeconds(intervalValue),
                "minutes" => TimeSpan.FromMinutes(intervalValue),
                "hours" => TimeSpan.FromHours(intervalValue),
                "days" => TimeSpan.FromDays(intervalValue),
                _ => TimeSpan.FromMinutes(intervalValue)
            };
        }
        catch
        {
            return TimeSpan.Zero;
        }
    }

    public override void Dispose()
    {
        foreach (var timer in _timers.Values)
        {
            timer.Dispose();
        }
        _timers.Clear();
        base.Dispose();
    }
}

