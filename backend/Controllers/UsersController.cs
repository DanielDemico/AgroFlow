using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.DTOs;
using MiniN8N.Api.Models;
using MiniN8N.Api.Services;

namespace MiniN8N.Api.Controllers;

[Authorize]
[ApiController]
[Route("users")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuthService _authService;

    public UsersController(AppDbContext context, IAuthService authService)
    {
        _context = context;
        _authService = authService;
    }

    [AllowAnonymous]
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] RegisterRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
            return BadRequest("User already exists.");

        var user = new User
        {
            Name = request.Name,
            Email = request.Email,
            PasswordHash = _authService.HashPassword(request.Password)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetStats), new { id = user.Id }, new { id = user.Id, name = user.Name, email = user.Email });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(int id)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] RegisterRequest request)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.Name = request.Name;
        user.Email = request.Email;
        if (!string.IsNullOrEmpty(request.Password))
        {
            user.PasswordHash = _authService.HashPassword(request.Password);
        }

        await _context.SaveChangesAsync();
        return Ok(new { id = user.Id, name = user.Name, email = user.Email });
    }

    [HttpGet("{id}/stats")]
    public async Task<ActionResult<UserStatsResponse>> GetStats(int id)
    {
        var workflows = await _context.Workflows.Where(w => w.UserId == id).ToListAsync();
        
        return new UserStatsResponse(
            workflows.Count,
            workflows.Count(w => w.IsActive),
            workflows.Count(w => !w.IsActive)
        );
    }
}
