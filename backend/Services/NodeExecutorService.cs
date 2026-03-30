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

        // Dictionary to hold outputs of each node
        var nodeOutputs = new Dictionary<int, object>();

        // 2. Queue nodes with 0 in-degree (Triggers)
        var queue = new Queue<int>(inDegree.Where(x => x.Value == 0).Select(x => x.Key));
        
        // 3. Process execution in topological order
        while (queue.Count > 0)
        {
            var nodeId = queue.Dequeue();
            var node = workflow.Nodes.First(n => n.Id == nodeId);

            // Get inputs from incoming connections
            var inputConnections = workflow.Connections.Where(c => c.TargetNodeId == nodeId).ToList();
            var inputs = inputConnections
                .Where(c => nodeOutputs.ContainsKey(c.SourceNodeId))
                .Select(c => nodeOutputs[c.SourceNodeId])
                .ToList();

            var output = await ExecuteNodeAsync(node, inputs);
            nodeOutputs[nodeId] = output;

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

    private async Task<object> ExecuteNodeAsync(Node node, List<object> inputs)
    {
        var config = JsonSerializer.Deserialize<JsonElement>(node.Object);
        var message = config.TryGetProperty("message", out var msgProp) ? msgProp.GetString() : "No message provided";
        var type = config.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : "";

        object nodeOutput = new { executedAt = DateTime.Now, nodeCategory = node.Category };

        if (node.Category == "trigger" || node.Category == "schedule")
        {
            _logger.LogInformation("[TRIGGER] {Category} ({Type}) executed at {Time}", node.Category, type, DateTime.Now);
        }
        else if (node.Category == "areas")
        {
            if (config.TryGetProperty("areasData", out var areasData))
            {
                if (areasData.TryGetProperty("features", out var features))
                {
                    _logger.LogInformation("[AREAS] Extracted {Count} areas to pass to next node.", features.GetArrayLength());
                    nodeOutput = features; // returning the JSON array of areas
                }
                else
                {
                    _logger.LogWarning("[AREAS] No features found in areasData.");
                    nodeOutput = new { error = "No features array found" };
                }
            }
            else
            {
                _logger.LogWarning("[AREAS] No areasData found in node config.");
                nodeOutput = new { error = "No areas data" };
            }
        }
        else if (node.Category == "action")
        {
            var serializedInputs = inputs.Count > 0 ? JsonSerializer.Serialize(inputs) : "No inputs received";
            switch (type)
            {
                case "console_alert":
                    Console.WriteLine($"[ALERT]: {message} | Inputs: {serializedInputs}");
                    break;
                case "print_log":
                    Console.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] [LOG]: {message} | Inputs: {serializedInputs}");
                    break;
                default:
                    _logger.LogWarning("Unknown action type: {Type}", type);
                    break;
            }
        }

        await Task.CompletedTask;
        return nodeOutput;
    }
}
