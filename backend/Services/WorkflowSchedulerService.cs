using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.Models;
using System.Text.Json;

namespace MiniN8N.Api.Services;

public class WorkflowSchedulerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<WorkflowSchedulerService> _logger;
    private readonly Dictionary<int, DateTime> _lastExecution = new();

    public WorkflowSchedulerService(IServiceProvider serviceProvider, ILogger<WorkflowSchedulerService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Workflow Scheduler Service starting...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var nodeExecutor = scope.ServiceProvider.GetRequiredService<INodeExecutorService>();

                var activeWorkflows = await context.Workflows
                    .Include(w => w.Nodes)
                    .Where(w => w.IsActive || w.IsTesting)
                    .ToListAsync(stoppingToken);

                foreach (var workflow in activeWorkflows)
                {
                    var scheduleNode = workflow.Nodes.FirstOrDefault(n => n.Category == "schedule");
                    if (scheduleNode == null) continue;

                    if (ShouldExecute(workflow.Id, scheduleNode))
                    {
                        _logger.LogInformation("Scheduled execution for workflow {WorkflowId} ({WorkflowName})", workflow.Id, workflow.Name);
                        await nodeExecutor.ExecuteWorkflowAsync(workflow.Id);
                        _lastExecution[workflow.Id] = DateTime.Now;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Workflow Scheduler Service loop.");
            }

            // Run every 5 seconds for responsive testing
            await Task.Delay(5000, stoppingToken);
        }
    }

    private bool ShouldExecute(int workflowId, Node scheduleNode)
    {
        try
        {
            var config = JsonSerializer.Deserialize<JsonElement>(scheduleNode.Object);
            var intervalValue = config.TryGetProperty("intervalValue", out var v) ? v.GetInt32() : 1;
            var intervalUnit = config.TryGetProperty("intervalUnit", out var u) ? u.GetString() : "minutes";

            if (!_lastExecution.TryGetValue(workflowId, out var lastRun))
            {
                return true; // Execute first time
            }

            TimeSpan interval = intervalUnit switch
            {
                "seconds" => TimeSpan.FromSeconds(intervalValue),
                "minutes" => TimeSpan.FromMinutes(intervalValue),
                "hours" => TimeSpan.FromHours(intervalValue),
                "days" => TimeSpan.FromDays(intervalValue),
                _ => TimeSpan.FromMinutes(intervalValue)
            };

            return DateTime.Now >= lastRun.Add(interval);
        }
        catch
        {
            return false;
        }
    }
}
