import { useState, useEffect } from "react";
import { X, FileText, Mail, BookOpen, Package, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TaskType = "email" | "template" | "literature" | "product";
type Priority = "High" | "Medium" | "Low";
type ActionType = "template" | "email" | "literature" | "products";

interface Task {
  id: string;
  title: string;
  source: string;
  type: TaskType;
  priority: Priority;
  description?: string;
  completed?: boolean;
}

interface PreviewContent {
  type: string;
  content: string | Array<{ title: string; description: string; link?: string }>;
}

// ============================================================================
// MOCK DATA CONFIGURATION
// ============================================================================
// Set USE_MOCK_DATA to false when you want to connect to your real backend
const USE_MOCK_DATA = true;

// Mock tasks data - replace this with your real API response
const MOCK_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Follow-up consultation notes for Patient Anderson",
    source: "Heidi AI",
    type: "template",
    priority: "High",
    description: "Generate comprehensive follow-up notes based on recent consultation discussing hypertension management and medication adjustment.",
  },
  {
    id: "task-2",
    title: "Send lab results to Dr. Smith's office",
    source: "AI generated",
    type: "email",
    priority: "High",
    description: "Patient's blood work came back - coordinate with referring physician's office for next steps.",
  },
  {
    id: "task-3",
    title: "Review latest diabetes management protocols",
    source: "Heidi AI",
    type: "literature",
    priority: "Medium",
    description: "Stay updated with recent clinical guidelines and research on Type 2 diabetes treatment options.",
  },
  {
    id: "task-4",
    title: "Order continuous glucose monitoring system",
    source: "AI generated",
    type: "product",
    priority: "Medium",
    description: "Patient requires CGM device - review available options and suppliers for optimal coverage.",
  },
  {
    id: "task-5",
    title: "Generate discharge summary for Patient Rodriguez",
    source: "Heidi AI",
    type: "template",
    priority: "Low",
    description: "Create detailed discharge documentation including treatment summary, medications, and follow-up instructions.",
    completed: true,
  },
  {
    id: "task-6",
    title: "Request prior authorization for MRI",
    source: "AI generated",
    type: "email",
    priority: "High",
    description: "Submit insurance authorization request for lumbar spine MRI with clinical justification.",
  },
];

// Mock action responses - customize these to match your backend response format
const MOCK_ACTION_RESPONSES: Record<ActionType, (taskTitle: string) => PreviewContent> = {
  template: (taskTitle) => ({
    type: "Clinical Template",
    content: `CLINICAL CONSULTATION NOTE

Patient: [Patient Name]
Date: ${new Date().toLocaleDateString()}
Provider: [Provider Name]

CHIEF COMPLAINT:
${taskTitle}

HISTORY OF PRESENT ILLNESS:
The patient presents today for follow-up regarding previously discussed treatment plan. Patient reports [symptoms/progress] since last visit.

ASSESSMENT:
1. [Primary diagnosis]
2. [Secondary diagnosis if applicable]

PLAN:
1. Continue current medication regimen
2. Follow up in 4-6 weeks
3. Lab work ordered as discussed
4. Patient education provided regarding treatment compliance

CLINICAL NOTES:
[Additional observations and recommendations]

_____________________________
[Provider Signature]
[Date/Time]`,
  }),
  
  email: (taskTitle) => ({
    type: "Email Draft",
    content: `Subject: ${taskTitle}

Dear [Recipient Name],

I hope this message finds you well. I am writing regarding our mutual patient, [Patient Name].

[Main content about the task - lab results, referral information, coordination needs, etc.]

Patient Details:
- Name: [Patient Name]
- DOB: [Date of Birth]
- MRN: [Medical Record Number]

Please let me know if you need any additional information or have questions.

Best regards,
[Your Name]
[Your Title]
[Contact Information]`,
  }),
  
  literature: () => ({
    type: "Recommended Literature",
    content: [
      {
        title: "2024 Clinical Practice Guidelines for Diabetes Management",
        description: "Comprehensive update on evidence-based treatment protocols, including new recommendations for GLP-1 agonists and SGLT2 inhibitors in Type 2 diabetes.",
        link: "https://example.com/guidelines-diabetes-2024",
      },
      {
        title: "Recent Advances in Hypertension Treatment",
        description: "Meta-analysis of recent trials comparing combination therapy approaches and optimal BP targets for different patient populations.",
        link: "https://example.com/hypertension-advances",
      },
      {
        title: "Patient-Centered Care in Chronic Disease Management",
        description: "Review of strategies to improve patient engagement and adherence in long-term treatment plans.",
        link: "https://example.com/patient-centered-care",
      },
    ],
  }),
  
  products: () => ({
    type: "Product Recommendations",
    content: [
      {
        title: "Dexcom G7 Continuous Glucose Monitor",
        description: "Latest generation CGM with 10-day wear time, real-time glucose readings, and mobile app integration. Covered by most insurance plans.",
        link: "https://example.com/dexcom-g7",
      },
      {
        title: "FreeStyle Libre 3 System",
        description: "Affordable CGM option with 14-day sensors and excellent accuracy. No fingerstick calibration required.",
        link: "https://example.com/freestyle-libre3",
      },
      {
        title: "Medtronic Guardian Connect",
        description: "Advanced CGM system with predictive alerts and SmartGuard technology. Ideal for patients requiring intensive monitoring.",
        link: "https://example.com/medtronic-guardian",
      },
    ],
  }),
};

// ============================================================================

interface TaskOverlayModalProps {
  open: boolean;
  onClose: () => void;
}

const typeIcons: Record<TaskType, typeof FileText> = {
  email: Mail,
  template: FileText,
  literature: BookOpen,
  product: Package,
};

const priorityColors: Record<Priority, string> = {
  High: "bg-priority-high text-white",
  Medium: "bg-priority-medium text-white",
  Low: "bg-priority-low text-white",
};

const actionButtons = [
  { id: "template", label: "Generate Template", icon: FileText },
  { id: "email", label: "Send Email", icon: Mail },
  { id: "literature", label: "Literature", icon: BookOpen },
  { id: "products", label: "Products", icon: Package },
] as const;

export function TaskOverlayModal({ open, onClose }: TaskOverlayModalProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [currentAction, setCurrentAction] = useState<ActionType | null>(null);
  const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);

  useEffect(() => {
    if (open) {
      fetchTasks();
    }
  }, [open]);

  // ============================================================================
  // BACKEND INTEGRATION POINT #1: Fetch Tasks
  // ============================================================================
  // Replace this function with your actual API call to fetch tasks
  // Expected response format: Array<Task>
  // Your endpoint might be: GET /api/tasks or GET /api/clinician/tasks
  const fetchTasks = async () => {
    setIsFetchingTasks(true);
    try {
      if (USE_MOCK_DATA) {
        // Simulate network delay for mock data
        await new Promise((resolve) => setTimeout(resolve, 500));
        setTasks(MOCK_TASKS);
        if (MOCK_TASKS.length > 0 && !selectedTask) {
          setSelectedTask(MOCK_TASKS[0]);
        }
      } else {
        // CONNECT YOUR BACKEND HERE:
        // Replace the URL with your actual backend endpoint
        const response = await fetch("http://localhost:5000/api/tasks", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Add authentication headers if needed:
            // "Authorization": `Bearer ${yourAuthToken}`,
          },
        });
        
        if (!response.ok) throw new Error("Failed to fetch tasks");
        const data = await response.json();
        
        setTasks(data);
        if (data.length > 0 && !selectedTask) {
          setSelectedTask(data[0]);
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
  // BACKEND INTEGRATION POINT #2: Execute Action (Generate Content)
  // ============================================================================
  // This function is called when user clicks an action button (Generate Template, etc.)
  // Replace with your actual API call to generate content based on the selected task and action
  // Expected request: { taskId: string, action: string }
  // Expected response: { type: string, content: string | Array<object> }
  const handleActionClick = async (action: ActionType) => {
    if (!selectedTask) return;

    setCurrentAction(action);
    setPreviewContent(null);
    setEditedContent("");
    setIsLoading(true);

    try {
      if (USE_MOCK_DATA) {
        // Simulate network delay for mock data
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Generate mock response based on action type
        const mockResponse = MOCK_ACTION_RESPONSES[action](selectedTask.title);
        setPreviewContent(mockResponse);
        
        if (typeof mockResponse.content === "string") {
          setEditedContent(mockResponse.content);
        }
      } else {
        // CONNECT YOUR BACKEND HERE:
        // Replace the URL with your actual backend endpoint
        // This endpoint should generate content (email, template, etc.) based on the task
        const response = await fetch("http://localhost:5000/api/tasks/action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add authentication headers if needed:
            // "Authorization": `Bearer ${yourAuthToken}`,
          },
          body: JSON.stringify({
            taskId: selectedTask.id,
            action: action,
            // You might want to include additional context:
            // taskDetails: selectedTask,
            // userId: currentUserId,
          }),
        });

        if (!response.ok) throw new Error("Failed to execute action");

        const data = await response.json();
        setPreviewContent(data);
        
        if (typeof data.content === "string") {
          setEditedContent(data.content);
        }
      }
    } catch (error) {
      console.error("Error executing action:", error);
      toast({
        title: "Error",
        description: "Failed to generate content. Please try again.",
        variant: "destructive",
      });
      setCurrentAction(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // BACKEND INTEGRATION POINT #3: Approve & Execute (Final Action)
  // ============================================================================
  // This function is called when user approves the generated content
  // This is where you actually send the email, save the document, etc.
  // Replace with your actual API call to execute the final action
  // Expected request: { taskId: string, action: string, content: string | object }
  // Expected response: success confirmation
  const handleApprove = async () => {
    if (!selectedTask || !currentAction) return;

    setIsExecuting(true);

    try {
      if (USE_MOCK_DATA) {
        // Simulate network delay for mock data
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Update task status locally
        setTasks((prev) =>
          prev.map((task) =>
            task.id === selectedTask.id ? { ...task, completed: true } : task
          )
        );

        toast({
          title: "Success",
          description: `${currentAction} executed successfully! (Mock mode)`,
        });
      } else {
        // CONNECT YOUR BACKEND HERE:
        // Replace the URL with your actual backend endpoint
        // This endpoint should perform the final action (send email, save template, etc.)
        const response = await fetch("http://localhost:5000/api/tasks/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add authentication headers if needed:
            // "Authorization": `Bearer ${yourAuthToken}`,
          },
          body: JSON.stringify({
            taskId: selectedTask.id,
            action: currentAction,
            content: editedContent || previewContent?.content,
            // You might want to include additional metadata:
            // executedBy: currentUserId,
            // executedAt: new Date().toISOString(),
            // modifications: editedContent !== previewContent?.content,
          }),
        });

        if (!response.ok) throw new Error("Failed to execute task");

        // Update task status locally
        setTasks((prev) =>
          prev.map((task) =>
            task.id === selectedTask.id ? { ...task, completed: true } : task
          )
        );

        toast({
          title: "Success",
          description: "Task executed successfully.",
        });
      }

      // Reset state
      setCurrentAction(null);
      setPreviewContent(null);
      setEditedContent("");
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

  const handleCancel = () => {
    setCurrentAction(null);
    setPreviewContent(null);
    setEditedContent("");
  };

  if (!open) return null;

  const TypeIcon = selectedTask ? typeIcons[selectedTask.type] : FileText;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-overlay/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-6xl max-h-[90vh] mx-4 bg-card rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
          <h2 className="text-xl font-semibold text-foreground">
            Smart Tasks Control Center
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(90vh-5rem)]">
          {/* Left Column - Task List */}
          <div className="w-[35%] border-r border-border bg-muted/30">
            <div className="p-4 border-b border-border">
              <h3 className="font-medium text-foreground">Tasks</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {tasks.filter((t) => !t.completed).length} pending tasks
              </p>
            </div>

            <ScrollArea className="h-[calc(100%-5rem)]">
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
                    const Icon = typeIcons[task.type];
                    return (
                      <button
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(task);
                          setCurrentAction(null);
                          setPreviewContent(null);
                        }}
                        className={cn(
                          "w-full p-4 rounded-lg border text-left transition-all",
                          "hover:border-primary/50 hover:bg-card",
                          selectedTask?.id === task.id
                            ? "border-primary bg-card shadow-sm"
                            : "border-border bg-card/50",
                          task.completed && "opacity-50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium text-sm line-clamp-2 text-foreground">
                            {task.title}
                          </h4>
                          {task.completed && (
                            <Check className="h-4 w-4 text-status-completed flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className="text-xs bg-secondary"
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {task.type}
                          </Badge>
                          <Badge
                            className={cn("text-xs", priorityColors[task.priority])}
                          >
                            {task.priority}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {task.source}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Column - Task Details */}
          <div className="flex-1 flex flex-col">
            {selectedTask ? (
              <>
                {/* Task Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-medical-blue-light">
                      <TypeIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {selectedTask.title}
                      </h3>
                      {selectedTask.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {selectedTask.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-xs", priorityColors[selectedTask.priority])}>
                          {selectedTask.priority} Priority
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {selectedTask.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {selectedTask.source}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-6 border-b border-border bg-muted/20">
                  <h4 className="text-sm font-medium text-foreground mb-3">
                    Select Action
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {actionButtons.map((action) => {
                      const ActionIcon = action.icon;
                      return (
                        <Button
                          key={action.id}
                          onClick={() => handleActionClick(action.id)}
                          disabled={isLoading || isExecuting}
                          variant={currentAction === action.id ? "default" : "outline"}
                          className="justify-start"
                        >
                          <ActionIcon className="h-4 w-4 mr-2" />
                          {action.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview & Verify Panel */}
                <ScrollArea className="flex-1 p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Generating content...
                        </p>
                      </div>
                    </div>
                  ) : previewContent ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-foreground">
                          Preview & Verify
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {previewContent.type}
                        </Badge>
                      </div>

                      {typeof previewContent.content === "string" ? (
                        <textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className="w-full min-h-[300px] p-4 rounded-lg border border-border bg-card text-foreground text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Generated content will appear here..."
                        />
                      ) : (
                        <div className="space-y-3">
                          {Array.isArray(previewContent.content) &&
                            previewContent.content.map((item, index) => (
                              <div
                                key={index}
                                className="p-4 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors"
                              >
                                <h5 className="font-medium text-foreground mb-1">
                                  {item.title}
                                </h5>
                                <p className="text-sm text-muted-foreground mb-2">
                                  {item.description}
                                </p>
                                {item.link && (
                                  <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline"
                                  >
                                    View details →
                                  </a>
                                )}
                              </div>
                            ))}
                        </div>
                      )}

                      <div className="flex items-start gap-2 p-3 rounded-lg bg-medical-blue-light border border-primary/20">
                        <div className="text-xs text-primary mt-0.5">ℹ</div>
                        <p className="text-xs text-foreground">
                          Review and edit the content before approving. Nothing will be sent or saved until you click "Approve & Execute".
                        </p>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button
                          onClick={handleApprove}
                          disabled={isExecuting}
                          className="flex-1"
                        >
                          {isExecuting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Approve & Execute
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleCancel}
                          variant="outline"
                          disabled={isExecuting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                          <TypeIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Select an action above to generate content
                        </p>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div>
                  <div className="inline-flex p-4 rounded-full bg-muted mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select a task to view details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
