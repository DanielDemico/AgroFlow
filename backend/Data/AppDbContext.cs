using Microsoft.EntityFrameworkCore;
using MiniN8N.Api.Models;

namespace MiniN8N.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; set; }
    public DbSet<Workflow> Workflows { get; set; }
    public DbSet<Node> Nodes { get; set; }
    public DbSet<Connection> Connections { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Workflow>()
            .HasOne(w => w.User)
            .WithMany(u => u.Workflows)
            .HasForeignKey(w => w.UserId);

        modelBuilder.Entity<Node>()
            .HasOne(n => n.Workflow)
            .WithMany(w => w.Nodes)
            .HasForeignKey(n => n.WorkflowId);

        modelBuilder.Entity<Connection>()
            .HasOne(c => c.Workflow)
            .WithMany(w => w.Connections)
            .HasForeignKey(c => c.WorkflowId);

        modelBuilder.Entity<Connection>()
            .HasOne(c => c.SourceNode)
            .WithMany()
            .HasForeignKey(c => c.SourceNodeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Connection>()
            .HasOne(c => c.TargetNode)
            .WithMany()
            .HasForeignKey(c => c.TargetNodeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
