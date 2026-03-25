using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.Models;
using System.Text.Json;

namespace MiniN8N.Api.Services;

public interface INodeExecutorService
{
    Task ExecuteWorkflowAsync(int workflowId);
}

public class NodeExecutorService : INodeExecutorService
{
    private readonly AppDbContext _context;
    private readonly ILogger<NodeExecutorService> _logger;

    public NodeExecutorService(AppDbContext context, ILogger<NodeExecutorService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task ExecuteWorkflowAsync(int workflowId)
    {
        var workflow = await _context.Workflows
            .Include(w => w.Nodes)
            .Include(w => w.Connections)
            .FirstOrDefaultAsync(w => w.Id == workflowId);

        if (workflow == null || (!workflow.IsActive && !workflow.IsTesting))
        {
            _logger.LogWarning("Workflow {WorkflowId} not found, inactive, or not in test mode.", workflowId);
            return;
        }

        // 1. Build adjacency list for topological sort
        var adj = workflow.Nodes.ToDictionary(n => n.Id, _ => new List<int>());
        var inDegree = workflow.Nodes.ToDictionary(n => n.Id, _ => 0);

        foreach (var conn in workflow.Connections)
        {
            if (adj.ContainsKey(conn.SourceNodeId) && adj.ContainsKey(conn.TargetNodeId))
            {
                adj[conn.SourceNodeId].Add(conn.TargetNodeId);
                inDegree[conn.TargetNodeId]++;
            }
        }

        // 2. Queue nodes with 0 in-degree (Triggers)
        var queue = new Queue<int>(inDegree.Where(x => x.Value == 0).Select(x => x.Key));
        
        // 3. Process execution in topological order
        while (queue.Count > 0)
        {
            var nodeId = queue.Dequeue();
            var node = workflow.Nodes.First(n => n.Id == nodeId);

            await ExecuteNodeAsync(node);

            foreach (var neighbor in adj[nodeId])
            {
                inDegree[neighbor]--;
                if (inDegree[neighbor] == 0)
                {
                    queue.Enqueue(neighbor);
                }
            }
        }
    }

    private async Task ExecuteNodeAsync(Node node)
    {
        var config = JsonSerializer.Deserialize<JsonElement>(node.Object);
        var message = config.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "No message provided";
        var type = config.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : "";

        if (node.Category == "trigger" || node.Category == "schedule")
        {
            _logger.LogInformation("[TRIGGER] {Category} ({Type}) executed at {Time}", node.Category, type, DateTime.Now);
        }
        else if (node.Category == "action")
        {
            switch (type)
            {
                case "console_alert":
                    Console.WriteLine($"[ALERT]: {message}");
                    break;
                case "print_log":
                    Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [LOG]: {message}");
                    break;
                default:
                    _logger.LogWarning("Unknown action type: {Type}", type);
                    break;
            }
        }

        await Task.CompletedTask;
    }
}
