using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.Models;

namespace MiniN8N.Api.Controllers;

[Authorize]
[ApiController]
[Route("nodes")]
public class NodesController : ControllerBase
{
    private readonly AppDbContext _context;

    public NodesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Node>> GetNode(int id)
    {
        var node = await _context.Nodes.FindAsync(id);
        if (node == null) return NotFound();
        return node;
    }

    [HttpPost]
    public async Task<ActionResult<Node>> CreateNode([FromBody] Node node)
    {
        _context.Nodes.Add(node);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetNode), new { id = node.Id }, node);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateNode(int id, [FromBody] Node node)
    {
        if (id != node.Id) return BadRequest();

        var existing = await _context.Nodes.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Category = node.Category;
        existing.Object = node.Object;
        existing.PositionX = node.PositionX;
        existing.PositionY = node.PositionY;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNode(int id)
    {
        var node = await _context.Nodes.FindAsync(id);
        if (node == null) return NotFound();

        // Delete associated connections first
        var connections = await _context.Connections
            .Where(c => c.SourceNodeId == id || c.TargetNodeId == id)
            .ToListAsync();
        
        _context.Connections.RemoveRange(connections);
        _context.Nodes.Remove(node);
        
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
