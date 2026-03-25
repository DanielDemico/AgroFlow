using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.Models;
using MiniN8N.Api.Services;

namespace MiniN8N.Api.Controllers;

[Authorize]
[ApiController]
[Route("workflows")]
public class WorkflowsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly INodeExecutorService _nodeExecutor;

    public WorkflowsController(AppDbContext context, INodeExecutorService nodeExecutor)
    {
        _context = context;
        _nodeExecutor = nodeExecutor;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Workflow>>> GetWorkflows()
    {
        return await _context.Workflows.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Workflow>> GetWorkflow(int id)
    {
        var workflow = await _context.Workflows
            .Include(w => w.Nodes)
            .Include(w => w.Connections)
            .FirstOrDefaultAsync(w => w.Id == id);

        if (workflow == null) return NotFound();
        return workflow;
    }

    [HttpPost]
    public async Task<ActionResult<Workflow>> CreateWorkflow([FromBody] Workflow workflow)
    {
        _context.Workflows.Add(workflow);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetWorkflow), new { id = workflow.Id }, workflow);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateWorkflow(int id, [FromBody] Workflow workflow)
    {
        if (id != workflow.Id) return BadRequest();

        var existing = await _context.Workflows.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Name = workflow.Name;
        existing.IsActive = workflow.IsActive;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkflow(int id)
    {
        var workflow = await _context.Workflows.FindAsync(id);
        if (workflow == null) return NotFound();

        _context.Workflows.Remove(workflow);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/execute")]
    public async Task<IActionResult> ExecuteWorkflow(int id)
    {
        try
        {
            await _nodeExecutor.ExecuteWorkflowAsync(id);
            return Ok(new { message = "Workflow execution completed." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error executing workflow.", error = ex.Message });
        }
    }

    [HttpPost("{id}/toggle-test")]
    public async Task<IActionResult> ToggleTest(int id, [FromQuery] bool active)
    {
        var workflow = await _context.Workflows.FindAsync(id);
        if (workflow == null) return NotFound();

        workflow.IsTesting = active;
        await _context.SaveChangesAsync();

        return Ok(new { isTesting = workflow.IsTesting });
    }
}
