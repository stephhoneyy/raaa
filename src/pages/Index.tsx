import { useState, useEffect } from "react";
import {
  FileText,
  Mail,
  BookOpen,
  Package,
  Loader2,
  Check,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ============================================================================
// TYPES
// ============================================================================

// Raw task from backend: { type, description }
interface ApiTask {
  type: string;
  title: string;
  prompt: string;
}

// Frontend task: includes derived id + title for UI
interface Task {
  id: string;
  title: string;
  type: string;       // raw action name from Heidi
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
  approved: boolean;
}

interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  sessionId: string;
}

// ============================================================================
// MOCK DATA CONFIGURATION
// ============================================================================

const USE_MOCK_DATA = false;

// Mock patient data - replace with your real API response
const MOCK_PATIENT: Patient = {
  id: "patient-001",
  name: "Sarah Anderson",
  dateOfBirth: "1978-05-15",
  sessionId: "SES-2024-7892",
};

// Mock tasks data - used only when USE_MOCK_DATA = true
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

// Mock action responses - used only when USE_MOCK_DATA = true
const MOCK_ACTION_RESPONSES: Record<string, (taskTitle: string) => PreviewContent> = {
  generate_document: (taskTitle) => ({
    type: "Session Note",
    content: `Generated document for: ${taskTitle}`,
  }),
  send_email: (taskTitle) => ({
    type: "Email Draft",
    content: `Generated email for: ${taskTitle}`,
  }),
  write_referral_letter: (taskTitle) => ({
    type: "Referral Letter",
    content: `Generated referral letter for: ${taskTitle}`,
  }),
};

// ============================================================================
// CONFIG
// ============================================================================

const API_BASE = "http://localhost:8000";

// Pick an icon based on the raw action type string
function getIconForTaskType(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes("email") || lower.includes("send")) return Mail;
  if (lower.includes("referral")) return BookOpen;
  if (lower.includes("order") || lower.includes("test") || lower.includes("prescription"))
    return Package;
  if (lower.includes("book") || lower.includes("appointment")) return Calendar;
  return FileText;
}

// Derive a title from the raw type, e.g. write_referral_letter -> "Write Referral Letter"
function humanizeType(type: string) {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<Map<string, GeneratedTask>>(
    new Map()
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecutingAll, setIsExecutingAll] = useState(false);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [executedTasksCount, setExecutedTasksCount] = useState(0);

  useEffect(() => {
    fetchTasks();
    fetchPatient();
  }, []);

  const fetchPatient = async () => {
    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setPatient(MOCK_PATIENT);
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

  // Auto-generate content when task is selected
  useEffect(() => {
    if (selectedTask && !generatedTasks.has(selectedTask.id)) {
      generateContentForTask(selectedTask);
    }
  }, [selectedTask]);

  // ============================================================================
  // BACKEND INTEGRATION POINT #1: Fetch Tasks
  // ============================================================================
  const fetchTasks = async () => {
    setIsFetchingTasks(true);
    try {
      if (USE_MOCK_DATA) {
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
  // BACKEND INTEGRATION POINT #2: Generate Content
  // ============================================================================
  const generateContentForTask = async (task: Task) => {
    setIsGenerating(true);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const mockFn = MOCK_ACTION_RESPONSES[task.type] || MOCK_ACTION_RESPONSES["generate_document"];
        const mockResponse = mockFn(task.title);

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
            taskType: task.type,        // raw action name only
            taskDetails: task,          // we send whole task; backend uses what it wants
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
      setIsGenerating(false);
    }
  };

  // ============================================================================
  // BACKEND INTEGRATION POINT #3: Execute All Tasks
  // ============================================================================
  const handleApprove = () => {
    if (!selectedTask) return;

    const currentTask = generatedTasks.get(selectedTask.id);
    if (!currentTask) return;

    const newApprovedState = !currentTask.approved;

    setGeneratedTasks((prev) =>
      new Map(prev).set(selectedTask.id, {
        ...currentTask,
        approved: newApprovedState,
      })
    );

    toast({
      title: newApprovedState ? "Task Approved" : "Approval Cancelled",
      description: newApprovedState
        ? "Task has been approved and is ready for execution."
        : "Task approval has been cancelled.",
      duration: 2000,
    });
  };

  const handleExecuteAll = async () => {
    const tasksToExecute = Array.from(generatedTasks.values()).filter(
      (t) => t.approved
    );

    if (tasksToExecute.length === 0) {
      toast({
        title: "No tasks to execute",
        description: "Please approve at least one task before executing.",
        variant: "destructive",
      });
      return;
    }

    setIsExecutingAll(true);

    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setExecutedTasksCount(tasksToExecute.length);

        setTasks((prev) => prev.filter((task) => !generatedTasks.has(task.id)));

        setGeneratedTasks(new Map());

        setShowSuccessModal(true);
      } else {
        const tasksPayload = tasksToExecute.map((genTask) => {
          const task = tasks.find((t) => t.id === genTask.taskId);
          return {
            taskType: task?.type, // raw action name
            content: genTask.editedContent || genTask.content.content,
          };
        });

        const response = await fetch(`${API_BASE}/api/tasks/execute-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tasks: tasksPayload,
            executedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) throw new Error("Failed to execute tasks");

        await response.json();

        setExecutedTasksCount(tasksToExecute.length);

        setTasks((prev) => prev.filter((task) => !generatedTasks.has(task.id)));

        setGeneratedTasks(new Map());

        setShowSuccessModal(true);
      }
    } catch (error) {
      console.error("Error executing tasks:", error);
      toast({
        title: "Error",
        description: "Failed to execute tasks. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExecutingAll(false);
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
  const currentGenerated = selectedTask ? generatedTasks.get(selectedTask.id) : null;
  const totalTasksCount = tasks.length;
  const approvedTasksCount = Array.from(generatedTasks.values()).filter(
    (t) => t.approved
  ).length;

  return (
    <div className="h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col overflow-hidden">
      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md animate-scale-in">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 animate-fade-in">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl">
              All Tasks Executed!
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Successfully completed {executedTasksCount} task
              {executedTasksCount !== 1 ? "s" : ""} for{" "}
              {patient?.name || "the patient"}.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="w-full"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="border-b border-border bg-card flex-shrink-0">
        <div className="container max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                shtebba task manager RAAWWRR
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {approvedTasksCount} of {totalTasksCount} tasks approved
              </p>
            </div>
            <Button
              onClick={handleExecuteAll}
              disabled={isExecutingAll || approvedTasksCount === 0}
              size="lg"
              className="gap-2"
            >
              {isExecutingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Execute All ({approvedTasksCount})
                </>
              )}
            </Button>
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
                        return (
                          <button
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={cn(
                              "w-full p-4 rounded-lg border text-left transition-all relative",
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

                            {/* <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                              {task.description}
                            </p> */}

                            {generatedTasks.get(task.id)?.approved && (
                              <Badge className="text-xs px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400">
                                Approved
                              </Badge>
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
                      {/* {selectedTask.description && (
                        <p className="text-sm text-muted-foreground">
                          {selectedTask.description}
                        </p>
                      )} */}
                    </div>

                    {/* Generated Content */}
                    <ScrollArea className="flex-1 p-4 pb-20">
                      {isGenerating ? (
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
                      ) : null}
                    </ScrollArea>

                    {/* Fixed Action Buttons */}
                    {currentGenerated && (
                      <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm p-3 flex-shrink-0">
                        <div className="flex gap-2 justify-end max-w-3xl mx-auto">
                          <Button variant="outline" className="gap-2">
                            Edit
                          </Button>
                          <Button
                            onClick={handleApprove}
                            className={cn(
                              "gap-2",
                              currentGenerated.approved
                                ? "bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            )}
                          >
                            {currentGenerated.approved ? "Approved" : "Approve"}
                          </Button>
                        </div>
                      </div>
                    )}
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
