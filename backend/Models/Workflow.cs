using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MiniN8N.Api.Models;

public class Workflow
{
    [Key]
    public int Id { get; set; }

    [Required]
    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
    public bool IsTesting { get; set; } = false;

    [Required]
    public int UserId { get; set; }

    [ForeignKey("UserId")]
    public User? User { get; set; }

    public ICollection<Node> Nodes { get; set; } = new List<Node>();
    public ICollection<Connection> Connections { get; set; } = new List<Connection>();
}
