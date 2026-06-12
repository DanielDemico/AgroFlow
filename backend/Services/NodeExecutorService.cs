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
            var areaName = config.TryGetProperty("areaName", out var anProp) ? anProp.GetString() : "Área";
            if (config.TryGetProperty("areasData", out var areasData))
            {
                if (areasData.TryGetProperty("features", out var features))
                {
                    _logger.LogInformation("[AREAS] Extracted {Count} areas for node '{AreaName}' to pass to next node.", features.GetArrayLength(), areaName);
                    nodeOutput = new { features, areaName };
                }
                else
                {
                    _logger.LogWarning("[AREAS] No features found in areasData.");
                    nodeOutput = new { features = new object[0], areaName };
                }
            }
            else
            {
                _logger.LogWarning("[AREAS] No areasData found in node config.");
                nodeOutput = new { features = new object[0], areaName };
            }
        }
        else if (node.Category == "ndvi")
        {
            var areasList = new List<(JsonElement feature, string customAreaName)>();
            foreach (var input in inputs)
            {
                if (input is JsonElement je)
                {
                    if (je.ValueKind == JsonValueKind.Object && je.TryGetProperty("features", out var featProp))
                    {
                        var customAreaName = (je.TryGetProperty("areaName", out var anProp) ? anProp.GetString() : "Área") ?? "Área";
                        if (featProp.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var item in featProp.EnumerateArray())
                            {
                                areasList.Add((item, customAreaName));
                            }
                        }
                    }
                    else if (je.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in je.EnumerateArray())
                        {
                            areasList.Add((item, "Área"));
                        }
                    }
                    else
                    {
                        areasList.Add((je, "Área"));
                    }
                }
            }

            var ndviDataList = new List<object>();

            // If no areas are connected, let's create a default mocked area for testing purposes
            if (areasList.Count == 0)
            {
                areasList.Add((JsonSerializer.Deserialize<JsonElement>("{\"properties\":{\"name\":\"Talhão Default\"}}"), "Área"));
            }

            int periodMonths = 6;
            if (config.TryGetProperty("periodMonths", out var pmProp))
            {
                periodMonths = pmProp.GetInt32();
            }

            string[] months;
            if (periodMonths == 3)
                months = new[] { "Abr", "Mai", "Jun" };
            else if (periodMonths == 12)
                months = new[] { "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun" };
            else
                months = new[] { "Jan", "Fev", "Mar", "Abr", "Mai", "Jun" };

            int idx = 0;
            foreach (var entry in areasList)
            {
                var area = entry.feature;
                var customName = entry.customAreaName;
                string areaName = "Área Desconhecida";
                if (area.ValueKind == JsonValueKind.Object && area.TryGetProperty("properties", out var props))
                {
                    if (props.TryGetProperty("name", out var nameProp))
                        areaName = nameProp.GetString() ?? areaName;
                    else if (props.TryGetProperty("Name", out var nameProp2))
                        areaName = nameProp2.GetString() ?? areaName;
                    else if (props.TryGetProperty("id", out var idProp))
                        areaName = $"Talhão {idProp.ToString()}";
                }

                if (areaName == "Área Desconhecida" || areaName.StartsWith("Talhão"))
                {
                    areaName = $"{customName} - Talhão {idx + 1}";
                }
                else
                {
                    areaName = $"{customName} - {areaName}";
                }

                int seed = areaName.GetHashCode() + idx;
                var rand = new Random(seed);

                double currentNdvi = Math.Round(0.12 + rand.NextDouble() * 0.78, 2);
                string classification = currentNdvi switch
                {
                    >= 0.7 => "Muito Alto",
                    >= 0.5 => "Alto",
                    >= 0.3 => "Moderado",
                    >= 0.1 => "Baixo",
                    _ => "Nulo/Água"
                };

                var temporalSeries = new List<object>();
                for (int i = 0; i < months.Length; i++)
                {
                    double phase = rand.NextDouble() * 2;
                    double amplitude = 0.1 + rand.NextDouble() * 0.15;
                    double seasonal = Math.Sin(i * 0.8 + phase) * amplitude;
                    double trend = (rand.NextDouble() - 0.5) * 0.1;
                    double ndviVal = Math.Clamp(currentNdvi + seasonal + trend, -1.0, 1.0);
                    temporalSeries.Add(new { date = months[i], ndvi = Math.Round(ndviVal, 2) });
                }

                double min = Math.Round(Math.Max(-1.0, currentNdvi - 0.15 - rand.NextDouble() * 0.15), 2);
                double q1 = Math.Round(currentNdvi - 0.05 - rand.NextDouble() * 0.05, 2);
                double median = Math.Round(currentNdvi, 2);
                double q3 = Math.Round(currentNdvi + 0.05 + rand.NextDouble() * 0.05, 2);
                double max = Math.Round(Math.Min(1.0, currentNdvi + 0.15 + rand.NextDouble() * 0.15), 2);

                ndviDataList.Add(new
                {
                    areaName,
                    currentNdvi,
                    classification,
                    temporalSeries,
                    boxplot = new { min, q1, median, q3, max }
                });
                idx++;
            }

            _logger.LogInformation("[NDVI] Processed NDVI data for {Count} areas over {Period} months.", ndviDataList.Count, periodMonths);
            nodeOutput = ndviDataList;
        }
        else if (node.Category == "analysis_temporal")
        {
            var ndviData = ExtractNdviData(inputs);
            var reports = ndviData.Select(d => 
                $"- Area: {d.AreaName} | Histórico: " + string.Join(", ", d.TemporalSeries.Select(t => $"{t.Date}: {t.Ndvi}"))
            );
            var reportString = string.Join("\n", reports);
            _logger.LogInformation("[ANALISE TEMPORAL] Relatório de Evolução:\n{Report}", reportString);
            nodeOutput = new { report = reportString, data = ndviData };
        }
        else if (node.Category == "analysis_boxplot")
        {
            var ndviData = ExtractNdviData(inputs);
            var reports = ndviData.Select(d => 
                $"- Area: {d.AreaName} | Boxplot -> Min: {d.Boxplot.Min}, Q1: {d.Boxplot.Q1}, Mediana: {d.Boxplot.Median}, Q3: {d.Boxplot.Q3}, Max: {d.Boxplot.Max}"
            );
            var reportString = string.Join("\n", reports);
            _logger.LogInformation("[ANALISE BOXPLOT] Relatório de Dispersão:\n{Report}", reportString);
            nodeOutput = new { report = reportString, data = ndviData };
        }
        else if (node.Category == "analysis_bar")
        {
            var ndviData = ExtractNdviData(inputs);
            var reports = ndviData.Select(d => 
                $"- Area: {d.AreaName} | NDVI: {d.CurrentNdvi} ({d.Classification})"
            );
            var reportString = string.Join("\n", reports);
            _logger.LogInformation("[ANALISE BARRA] Relatório Comparativo:\n{Report}", reportString);
            nodeOutput = new { report = reportString, data = ndviData };
        }
        else if (node.Category == "email")
        {
            var ndviData = ExtractNdviData(inputs);
            var recipient = config.TryGetProperty("to", out var toProp) ? toProp.GetString() : "produtor@agroflow.com";
            var subject = config.TryGetProperty("subject", out var subProp) ? subProp.GetString() : "Relatório de Monitoramento NDVI - AgroFlow";
            
            bool hasLowNdvi = ndviData.Any(d => d.CurrentNdvi < 0.3);
            
            var bodyBuilder = new System.Text.StringBuilder();
            bodyBuilder.AppendLine("==================================================================");
            bodyBuilder.AppendLine($"E-MAIL ENVIADO PARA: {recipient}");
            bodyBuilder.AppendLine($"ASSUNTO: {subject}");
            bodyBuilder.AppendLine("==================================================================");
            bodyBuilder.AppendLine("Corpo do E-mail (HTML Gerado):");
            bodyBuilder.AppendLine("------------------------------------------------------------------");
            bodyBuilder.AppendLine("<div style=\"font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b; text-align: left;\">");
            bodyBuilder.AppendLine("  <div style=\"background-color: #0f172a; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;\">");
            bodyBuilder.AppendLine("    <h1 style=\"color: #ffffff; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.05em;\">AgroFlow</h1>");
            bodyBuilder.AppendLine("    <p style=\"color: #10b981; margin: 5px 0 0 0; font-size: 11px; font-weight: 600; text-transform: uppercase;\">Relatório Executivo de Saúde Vegetal</p>");
            bodyBuilder.AppendLine("  </div>");
            bodyBuilder.AppendLine("  <div style=\"padding: 24px 20px;\">");
            bodyBuilder.AppendLine("    <h2 style=\"color: #0f172a; margin-top: 0; font-size: 16px; font-weight: bold; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;\">Monitoramento NDVI</h2>");
            bodyBuilder.AppendLine("    <p style=\"font-size: 14px; line-height: 1.5; color: #475569;\">");
            bodyBuilder.AppendLine("      Olá, este é o relatório automatizado gerado pelo seu fluxo de trabalho AgroFlow.");
            bodyBuilder.AppendLine("    </p>");
            bodyBuilder.AppendLine("    <table style=\"width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;\">");
            bodyBuilder.AppendLine("      <thead>");
            bodyBuilder.AppendLine("        <tr style=\"background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;\">");
            bodyBuilder.AppendLine("          <th style=\"padding: 10px; text-align: left; font-weight: bold; color: #475569;\">Área / Talhão</th>");
            bodyBuilder.AppendLine("          <th style=\"padding: 10px; text-align: center; font-weight: bold; color: #475569;\">NDVI Médio</th>");
            bodyBuilder.AppendLine("          <th style=\"padding: 10px; text-align: right; font-weight: bold; color: #475569;\">Classificação</th>");
            bodyBuilder.AppendLine("        </tr>");
            bodyBuilder.AppendLine("      </thead>");
            bodyBuilder.AppendLine("      <tbody>");
            
            foreach (var d in ndviData)
            {
                string color = d.CurrentNdvi switch
                {
                    >= 0.7 => "#047857",
                    >= 0.5 => "#10b981",
                    >= 0.3 => "#84cc16",
                    >= 0.1 => "#eab308",
                    _ => "#3b82f6"
                };
                bodyBuilder.AppendLine("        <tr style=\"border-bottom: 1px solid #f1f5f9;\">");
                bodyBuilder.AppendLine($"          <td style=\"padding: 10px; font-weight: 600; color: #334155;\">{d.AreaName}</td>");
                bodyBuilder.AppendLine($"          <td style=\"padding: 10px; text-align: center; font-weight: bold; color: {color};\">{d.CurrentNdvi}</td>");
                bodyBuilder.AppendLine($"          <td style=\"padding: 10px; text-align: right; font-weight: 600; color: {color};\">{d.Classification}</td>");
                bodyBuilder.AppendLine("        </tr>");
            }
            
            bodyBuilder.AppendLine("      </tbody>");
            bodyBuilder.AppendLine("    </table>");
            
            string boxColor = hasLowNdvi ? "#fffbeb" : "#ecfdf5";
            string borderColor = hasLowNdvi ? "#fef3c7" : "#d1fae5";
            string titleColor = hasLowNdvi ? "#b45309" : "#047857";
            string textColor = hasLowNdvi ? "#d97706" : "#065f46";
            string boxTitle = hasLowNdvi ? "⚠️ Recomendações Críticas" : "✅ Status Saudável";
            string recommendation = hasLowNdvi
                ? "Atenção: Um ou mais talhões apresentam NDVI crítico (menor que 0.3), indicando solo exposto ou vegetação rala/sofrida. Recomenda-se realizar verificação presencial para avaliar necessidades de irrigação e nutrientes."
                : "Excelente! Todos os talhões monitorados encontram-se em condições vegetativas estáveis e saudáveis. Nenhuma ação imediata é necessária.";

            bodyBuilder.AppendLine($"    <div style=\"margin-top: 25px; padding: 15px; border-radius: 8px; background-color: {boxColor}; border: 1px solid {borderColor};\">");
            bodyBuilder.AppendLine($"      <h3 style=\"margin-top: 0; margin-bottom: 8px; font-size: 14px; font-weight: bold; color: {titleColor};\">{boxTitle}</h3>");
            bodyBuilder.AppendLine($"      <p style=\"margin: 0; font-size: 12px; line-height: 1.5; color: {textColor};\">{recommendation}</p>");
            bodyBuilder.AppendLine("    </div>");
            bodyBuilder.AppendLine("  </div>");
            bodyBuilder.AppendLine("  <div style=\"background-color: #f8fafc; padding: 15px; border-radius: 0 0 8px 8px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8;\">");
            bodyBuilder.AppendLine("    Este e-mail é gerado automaticamente pelo motor do AgroFlow. Não responda a este endereço.");
            bodyBuilder.AppendLine("  </div>");
            bodyBuilder.AppendLine("</div>");
            bodyBuilder.AppendLine("------------------------------------------------------------------");
            bodyBuilder.AppendLine("==================================================================");

            var emailHtml = bodyBuilder.ToString();
            _logger.LogInformation("[EMAIL NODE] Executado. Corpo gerado:\n{EmailReport}", emailHtml);
            nodeOutput = new { to = recipient, subject = subject, body = emailHtml };
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

    private class NdviRecord
    {
        public string AreaName { get; set; } = "";
        public double CurrentNdvi { get; set; }
        public string Classification { get; set; } = "";
        public List<TemporalPoint> TemporalSeries { get; set; } = new();
        public BoxplotStats Boxplot { get; set; } = new();
    }

    private class TemporalPoint
    {
        public string Date { get; set; } = "";
        public double Ndvi { get; set; }
    }

    private class BoxplotStats
    {
        public double Min { get; set; }
        public double Q1 { get; set; }
        public double Median { get; set; }
        public double Q3 { get; set; }
        public double Max { get; set; }
    }

    private List<NdviRecord> ExtractNdviData(List<object> inputs)
    {
        var result = new List<NdviRecord>();
        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
        
        foreach (var input in inputs)
        {
            try
            {
                JsonElement element;
                if (input is JsonElement je)
                {
                    element = je;
                }
                else
                {
                    var serializedObj = JsonSerializer.Serialize(input);
                    element = JsonSerializer.Deserialize<JsonElement>(serializedObj);
                }

                if (element.ValueKind == JsonValueKind.Object && element.TryGetProperty("data", out var dataProp))
                {
                    element = dataProp;
                }

                if (element.ValueKind == JsonValueKind.Array)
                {
                    var list = JsonSerializer.Deserialize<List<NdviRecord>>(element.GetRawText(), options);
                    if (list != null)
                    {
                        result.AddRange(list);
                    }
                }
                else if (element.ValueKind == JsonValueKind.Object)
                {
                    var single = JsonSerializer.Deserialize<NdviRecord>(element.GetRawText(), options);
                    if (single != null)
                    {
                        result.Add(single);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse NDVI input in analysis node");
            }
        }
        return result;
    }
}
