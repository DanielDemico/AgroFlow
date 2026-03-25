using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniN8N.Api.Models;

public class Connection
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int SourceNodeId { get; set; }

    [ForeignKey("SourceNodeId")]
    public Node? SourceNode { get; set; }

    [Required]
    public int TargetNodeId { get; set; }

    [ForeignKey("TargetNodeId")]
    public Node? TargetNode { get; set; }

    public string Path { get; set; } = "[]"; // JSON string [{x,y}]

    [Required]
    public int WorkflowId { get; set; }

    [ForeignKey("WorkflowId")]
    public Workflow? Workflow { get; set; }
}
