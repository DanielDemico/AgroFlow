using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniN8N.Api.Models;

public class Node
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Category { get; set; } = string.Empty; // trigger, action

    [Required]
    public string Object { get; set; } = "{}"; // JSON string

    public double PositionX { get; set; }
    public double PositionY { get; set; }

    [Required]
    public int WorkflowId { get; set; }

    [ForeignKey("WorkflowId")]
    public Workflow? Workflow { get; set; }
}
