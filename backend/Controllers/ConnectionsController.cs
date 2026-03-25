using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.Models;

namespace MiniN8N.Api.Controllers;

[Authorize]
[ApiController]
[Route("connections")]
public class ConnectionsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ConnectionsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Connection>> GetConnection(int id)
    {
        var connection = await _context.Connections.FindAsync(id);
        if (connection == null) return NotFound();
        return connection;
    }

    [HttpPost]
    public async Task<ActionResult<Connection>> CreateConnection([FromBody] Connection connection)
    {
        _context.Connections.Add(connection);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetConnection), new { id = connection.Id }, connection);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateConnection(int id, [FromBody] Connection connection)
    {
        if (id != connection.Id) return BadRequest();

        var existing = await _context.Connections.FindAsync(id);
        if (existing == null) return NotFound();

        existing.SourceNodeId = connection.SourceNodeId;
        existing.TargetNodeId = connection.TargetNodeId;
        existing.Path = connection.Path;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteConnection(int id)
    {
        var connection = await _context.Connections.FindAsync(id);
        if (connection == null) return NotFound();

        _context.Connections.Remove(connection);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
