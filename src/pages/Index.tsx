import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Mail,
  BookOpen,
  Package,
  Loader2,
  Send,
  User,
  Calendar,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

// ============================================================================
// TYPES
// ============================================================================

interface ApiTask {
  type: string;
  title: string;
  prompt: string;
}

interface Task {
  id: string;
  title: string;
  type: string; // raw action name from Heidi
  prompt: string;
  data?: string;
}

interface PreviewContent {
  type: string;
  content: string | Array<{ title: string; description: string; link?: string }>;
}

interface GeneratedTask {
  taskId: string;
  content: PreviewContent;
  editedContent?: string;
  approved: boolean; // kept for now, not used in UI
}

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  sessionId: string;
}

// ============================================================================
// CONFIG
// ============================================================================

const USE_MOCK_DATA = false;
const API_BASE = "http://localhost:8000";

function getIconForTaskType(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("email") || lower.includes("send")) return Mail;
  if (lower.includes("referral")) return BookOpen;
  if (lower.includes("order") || lower.includes("test") || lower.includes("prescription"))
    return Package;
  if (lower.includes("book") || lower.includes("appointment")) return Calendar;
  return FileText;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<Map<string, GeneratedTask>>(
    new Map()
  );
  const [generatingTaskIds, setGeneratingTaskIds] = useState<Set<string>>(
    () => new Set()
  ); // 👈 per-task generating
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);

  useEffect(() => {
    fetchTasks();
    fetchPatient();
  }, []);

  const fetchPatient = async () => {
    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setPatient({
          id: "patient-001",
          name: "Sarah Anderson",
          dateOfBirth: "1978-05-15",
          sessionId: "SES-2024-7892",
        });
      } else {
        const response = await fetch(`${API_BASE}/api/patient`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) throw new Error("Failed to fetch patient");
        const data: Patient = await response.json();
        setPatient(data);
      }
    } catch (error) {
      console.error("Error fetching patient:", error);
    }
  };

  // ============================================================================
  // Fetch Tasks
  // ============================================================================
  const fetchTasks = async () => {
    setIsFetchingTasks(true);
    try {
      if (USE_MOCK_DATA) {
        const MOCK_TASKS: Task[] = [
          {
            id: "task-1",
            title: "Create session note from consultation transcript",
            type: "generate_document",
            prompt:
              "Generate comprehensive session note from today's consultation with Sarah Anderson discussing occupational therapy progress and mobility goals.",
          },
          {
            id: "task-2",
            title: "Send session note to parent",
            type: "send_email",
            prompt:
              "Email session summary to Sarah's parents with progress updates and home exercise recommendations.",
          },
          {
            id: "task-3",
            title: "Refer patient to physiotherapist",
            type: "write_referral_letter",
            prompt:
              "Find physiotherapist near patient's residence (Bondi) and send referral letter for lower limb strengthening program.",
          },
        ];
        await new Promise((resolve) => setTimeout(resolve, 500));
        setTasks(MOCK_TASKS);
        if (MOCK_TASKS.length > 0 && !selectedTask) {
          setSelectedTask(MOCK_TASKS[0]);
        }
      } else {
        const response = await fetch(`${API_BASE}/api/tasks`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) throw new Error("Failed to fetch tasks");
        const apiData: ApiTask[] = await response.json();

        const normalised: Task[] = apiData.map((t, idx) => ({
          id: `task-${idx + 1}`,
          title: t.title,
          type: t.type,
          prompt: t.prompt,
        }));

        setTasks(normalised);
        if (normalised.length > 0 && !selectedTask) {
          setSelectedTask(normalised[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsFetchingTasks(false);
    }
  };

  // ============================================================================
  // Generate Content for a Task (per-task loading)
  // ============================================================================
  const generateContentForTask = async (task: Task) => {
    // mark this task as generating
    setGeneratingTaskIds((prev) => {
      const next = new Set(prev);
      next.add(task.id);
      return next;
    });

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const mockResponse: PreviewContent = {
          type: "Mock Content",
          content: `Generated content for: ${task.title}`,
        };

        setGeneratedTasks((prev) => {
          const newMap = new Map(prev);
          newMap.set(task.id, {
            taskId: task.id,
            content: mockResponse,
            editedContent:
              typeof mockResponse.content === "string"
                ? mockResponse.content
                : undefined,
            approved: false,
          });
          return newMap;
        });
      } else {
        const response = await fetch(`${API_BASE}/api/tasks/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskType: task.type,
            taskDetails: task,
          }),
        });

        if (!response.ok) throw new Error("Failed to generate content");

        const data: PreviewContent = await response.json();

        setGeneratedTasks((prev) => {
          const newMap = new Map(prev);
          newMap.set(task.id, {
            taskId: task.id,
            content: data,
            editedContent:
              typeof data.content === "string" ? data.content : undefined,
            approved: false,
          });
          return newMap;
        });
      }
    } catch (error) {
      console.error("Error generating content:", error);
      toast({
        title: "Error",
        description: "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    } finally {
      // unmark this task
      setGeneratingTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  // ============================================================================
  // Execute a Single Task
  // ============================================================================
  const handleExecuteTask = async () => {
    if (!selectedTask) return;

    const currentGenerated = generatedTasks.get(selectedTask.id);
    if (!currentGenerated) return;

    setIsExecuting(true);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        const response = await fetch(`${API_BASE}/api/tasks/execute-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tasks: [
              {
                taskId: selectedTask.id,
                taskType: selectedTask.type,
                content:
                  currentGenerated.editedContent ||
                  currentGenerated.content.content,
              },
            ],
            executedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) throw new Error("Failed to execute task");
        await response.json();
      }

      const currentIndex = tasks.findIndex((t) => t.id === selectedTask.id);
      const nextTask =
        currentIndex >= 0 && currentIndex < tasks.length - 1
          ? tasks[currentIndex + 1]
          : null;

      setTasks((prev) => prev.filter((t) => t.id !== selectedTask.id));
      setGeneratedTasks((prev) => {
        const newMap = new Map(prev);
        newMap.delete(selectedTask.id);
        return newMap;
      });

      setSelectedTask(nextTask || null);

      toast({
        title: "Task Executed",
        description: "Task has been successfully executed.",
        duration: 2000, 
      });
    } catch (error) {
      console.error("Error executing task:", error);
      toast({
        title: "Error",
        description: "Failed to execute task. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleContentEdit = (taskId: string, newContent: string) => {
    setGeneratedTasks((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(taskId);
      if (existing) {
        newMap.set(taskId, {
          ...existing,
          editedContent: newContent,
        });
      }
      return newMap;
    });
  };

  const TypeIcon = selectedTask ? getIconForTaskType(selectedTask.type) : FileText;
  const currentGenerated = selectedTask
    ? generatedTasks.get(selectedTask.id)
    : null;
  const totalTasksCount = tasks.length;
  const isCurrentGenerating = selectedTask
    ? generatingTaskIds.has(selectedTask.id)
    : false;

  return (
    <div className="h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card flex-shrink-0">
        <div className="container max-w-7xl mx-auto px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Heidle
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {totalTasksCount} tasks pending
              </p>
            </div>
          </div>

          {/* Patient Detail Card */}
          {patient && (
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-3 animate-fade-in">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Patient</p>
                    <p className="font-semibold text-foreground">
                      {patient.name}
                    </p>
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">DOB</p>
                    <p className="text-sm text-foreground">
                      {new Date(patient.dateOfBirth).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Session ID</p>
                    <p className="text-sm font-mono text-foreground">
                      {patient.sessionId}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="container max-w-7xl mx-auto p-4 h-full">
          <div className="bg-card rounded-2xl shadow-2xl overflow-hidden h-full">
            <div className="flex h-full">
              {/* Left Column - Task List */}
              <div className="w-[35%] border-r border-border bg-muted/30 flex flex-col">
                <div className="p-4 border-b border-border flex-shrink-0">
                  <h3 className="font-medium text-foreground">Tasks</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tasks.length} tasks
                  </p>
                </div>

                <ScrollArea className="flex-1">
                  {isFetchingTasks ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <p className="text-muted-foreground">No tasks available</p>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {tasks.map((task) => {
                        const Icon = getIconForTaskType(task.type);
                        const isTaskGenerating = generatingTaskIds.has(task.id);

                        return (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={cn(
                              "w-full p-4 rounded-lg border text-left transition-all relative overflow-hidden",
                              "hover:border-primary/50 hover:bg-card",
                              selectedTask?.id === task.id
                                ? "border-primary bg-card shadow-sm"
                                : "border-border bg-card/50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="font-medium text-sm line-clamp-2 text-foreground">
                                {task.title}
                              </h4>
                              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            </div>

                            <div className="flex items-center justify-between">
                              {generatedTasks.get(task.id) && (
                                <Badge className="text-xs px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400">
                                  Generated
                                </Badge>
                              )}
                              {isTaskGenerating && (
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  Generating...
                                </span>
                              )}
                            </div>

                            {isTaskGenerating && (
                              <div className="mt-2 -mx-4 -mb-4">
                                <Progress value={undefined} className="h-1 rounded-none" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Right Column - Task Details & Generated Content */}
              <div className="flex-1 flex flex-col relative">
                {!selectedTask ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <p>Select a task to view details</p>
                  </div>
                ) : (
                  <>
                    {/* Task Header */}
                    <div className="border-b border-border p-4 bg-card/50 flex-shrink-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <TypeIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-foreground">
                              {selectedTask.title}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                              {selectedTask.type}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Generated Content */}
                    <ScrollArea className="flex-1 p-4 pb-20">
                      {isCurrentGenerating && !currentGenerated ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            Generating content for this task...
                          </p>
                        </div>
                      ) : currentGenerated ? (
                        <div className="max-w-3xl mx-auto">
                          <div className="mb-4">
                            <h3 className="text-base font-semibold text-foreground mb-1">
                              {currentGenerated.content.type}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              Review and edit the generated content.
                            </p>
                          </div>

                          {typeof currentGenerated.content.content === "string" ? (
                            <div className="bg-card border border-border rounded-lg overflow-hidden">
                              <Textarea
                                value={currentGenerated.editedContent || ""}
                                onChange={(e) =>
                                  handleContentEdit(
                                    selectedTask.id,
                                    e.target.value
                                  )
                                }
                                className="min-h-[400px] font-mono text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                                placeholder="Content will appear here..."
                              />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {(currentGenerated.content.content as Array<{
                                title: string;
                                description: string;
                                link?: string;
                              }>).map((item, index) => (
                                <div
                                  key={index}
                                  className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
                                >
                                  <h4 className="font-semibold text-foreground mb-1 text-sm">
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-muted-foreground mb-2">
                                    {item.description}
                                  </p>
                                  {item.link && (
                                    <a
                                      href={item.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline"
                                    >
                                      View Resource →
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          Click &quot;Execute&quot; to generate content for this task.
                        </div>
                      )}
                    </ScrollArea>

                    {/* Bottom Action Button */}
                    <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm p-3 flex-shrink-0">
                      <div className="flex gap-2 justify-end max-w-3xl mx-auto">
                        {!currentGenerated ? (
                          <Button
                            onClick={() =>
                              selectedTask && generateContentForTask(selectedTask)
                            }
                            disabled={
                              !selectedTask ||
                              generatingTaskIds.has(selectedTask.id)
                            }
                            className="gap-2"
                          >
                            {selectedTask && generatingTaskIds.has(selectedTask.id) ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Execute
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleExecuteTask}
                            disabled={isExecuting}
                            className="gap-2"
                          >
                            {isExecuting ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Executing...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Confirm &amp; Execute
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
