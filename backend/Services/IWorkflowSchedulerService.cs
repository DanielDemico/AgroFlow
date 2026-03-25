namespace MiniN8N.Api.Services;

public interface IWorkflowSchedulerService
{
    void ScheduleWorkflow(int workflowId);
    void UnscheduleWorkflow(int workflowId);
    Task ManualTriggerAsync(int workflowId);
}
