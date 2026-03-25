using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Data;
using MiniN8N.Api.DTOs;
using MiniN8N.Api.Models;
using MiniN8N.Api.Services;

namespace MiniN8N.Api.Controllers;

[ApiController]
[Route("auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuthService _authService;

    public AuthController(AppDbContext context, IAuthService authService)
    {
        _context = context;
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
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

        return Ok(new { message = "User registered successfully." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _context.Users
            .Include(u => u.RefreshTokens)
            .FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user == null || !_authService.VerifyPassword(request.Password, user.PasswordHash))
            return Unauthorized("Invalid credentials.");

        var accessToken = _authService.GenerateAccessToken(user);
        var refreshToken = _authService.GenerateRefreshToken();

        user.RefreshTokens.Add(new RefreshToken
        {
            Token = refreshToken,
            ExpiryDate = DateTime.UtcNow.AddDays(7),
            UserId = user.Id
        });

        await _context.SaveChangesAsync();

        return Ok(new AuthResponse(accessToken, refreshToken, user.Id, user.Name));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
    {
        var refreshToken = await _context.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken && !r.IsRevoked && r.ExpiryDate > DateTime.UtcNow);

        if (refreshToken == null || refreshToken.User == null)
            return Unauthorized("Invalid or expired refresh token.");

        var newAccessToken = _authService.GenerateAccessToken(refreshToken.User);
        var newRefreshToken = _authService.GenerateRefreshToken();

        // Rotate token
        refreshToken.IsRevoked = true;
        _context.RefreshTokens.Add(new RefreshToken
        {
            Token = newRefreshToken,
            ExpiryDate = DateTime.UtcNow.AddDays(7),
            UserId = refreshToken.UserId
        });

        await _context.SaveChangesAsync();

        return Ok(new AuthResponse(newAccessToken, newRefreshToken, refreshToken.UserId, refreshToken.User.Name));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest request)
    {
        var refreshToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken);

        if (refreshToken != null)
        {
            refreshToken.IsRevoked = true;
            await _context.SaveChangesAsync();
        }

        return Ok(new { message = "Logged out successfully." });
    }
}
