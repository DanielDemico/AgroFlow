namespace MiniN8N.Api.DTOs;

public record LoginRequest(string Email, string Password);
public record RegisterRequest(string Name, string Email, string Password);
public record AuthResponse(string AccessToken, string RefreshToken, int UserId, string Name);
public record RefreshRequest(string RefreshToken);
public record UserStatsResponse(int TotalWorkflows, int ActiveWorkflows, int InactiveWorkflows);
