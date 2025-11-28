import { useState, useEffect } from "react";
import { FileText, Mail, BookOpen, Package, Loader2, Check, Send, User, Calendar, Hash } from "lucide-react";
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

type TaskType = "documentation" | "send" | "referrals" | "order" | "store" | "book" | "finance" | "reminder";
type ActionType = "documentation" | "send" | "referrals" | "order" | "store" | "book" | "finance" | "reminder";

interface Task {
  id: string;
  title: string;
  type: TaskType;
  description?: string;
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
// Set USE_MOCK_DATA to false when you want to connect to your real backend
const USE_MOCK_DATA = true;

// Mock patient data - replace with your real API response
const MOCK_PATIENT: Patient = {
  id: "patient-001",
  name: "Sarah Anderson",
  dateOfBirth: "1978-05-15",
  sessionId: "SES-2024-7892",
};

// Mock tasks data - replace this with your real API response
const MOCK_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Create session note from consultation transcript",
    type: "documentation",
    description: "Generate comprehensive session note from today's consultation with Sarah Anderson discussing occupational therapy progress and mobility goals.",
  },
  {
    id: "task-2",
    title: "Send session note to parent",
    type: "send",
    description: "Email session summary to Sarah's parents with progress updates and home exercise recommendations.",
  },
  {
    id: "task-3",
    title: "Refer patient to physiotherapist",
    type: "referrals",
    description: "Find physiotherapist near patient's residence (Bondi) and send referral letter for lower limb strengthening program.",
  },
  {
    id: "task-4",
    title: "Order manual wheelchair for patient",
    type: "order",
    description: "Patient requires manual wheelchair. Search Aidacare for options suitable for 165cm height, 68kg weight.",
  },
  {
    id: "task-5",
    title: "Upload session note to EMR",
    type: "store",
    description: "Save completed session documentation to patient's electronic medical record in Heidi.",
  },
  {
    id: "task-6",
    title: "Book follow-up appointment",
    type: "book",
    description: "Schedule next occupational therapy session in 2 weeks - patient prefers Tuesday afternoons.",
  },
  {
    id: "task-7",
    title: "Create invoice for today's session",
    type: "finance",
    description: "Generate invoice for 60-minute OT consultation and send to patient and their insurance provider.",
  },
  {
    id: "task-8",
    title: "Send appointment reminder",
    type: "reminder",
    description: "Text reminder to Sarah Anderson about upcoming appointment on Tuesday, March 12th at 2:00 PM.",
  },
];

// Mock action responses - customize these to match your backend response format
const MOCK_ACTION_RESPONSES: Record<ActionType, (taskTitle: string) => PreviewContent> = {
  documentation: (taskTitle) => ({
    type: "Session Note",
    content: `OCCUPATIONAL THERAPY SESSION NOTE

Patient: Sarah Anderson
Date: ${new Date().toLocaleDateString()}
Clinician: Dr. Emily Carter, OT
Session Duration: 60 minutes

PRESENTING CONCERN:
${taskTitle}

CONSULTATION SUMMARY:
Patient attended for occupational therapy assessment and intervention. Discussion focused on mobility goals, adaptive equipment needs, and home modification recommendations.

Key Discussion Points:
- Current functional limitations in daily living activities
- Progress with upper limb strengthening exercises
- Assessment for wheelchair prescription
- Home safety evaluation

CLINICAL OBSERVATIONS:
- Patient demonstrated improved grip strength (R: 15kg, L: 12kg)
- Transfers require moderate assistance
- Patient motivated and engaged throughout session

INTERVENTION PROVIDED:
1. Upper limb strengthening exercises (3 sets x 10 reps)
2. Transfer training with occupational therapist supervision
3. Education on adaptive equipment options
4. Home exercise program updated

GOALS FOR NEXT SESSION:
- Continue strengthening program
- Independent transfers with minimal assistance
- Trial of recommended wheelchair

PLAN:
- Follow up in 2 weeks
- Refer to physiotherapy for lower limb strengthening
- Order manual wheelchair for trial
- Parent/carer education session to be scheduled

_____________________________
Dr. Emily Carter, OT
${new Date().toLocaleString()}`,
  }),
  
  send: (taskTitle) => ({
    type: "Email Draft",
    content: `To: sarah.anderson.parents@email.com
Subject: Session Update - Sarah Anderson - ${new Date().toLocaleDateString()}

Dear Mr. and Mrs. Anderson,

I hope this email finds you well. I wanted to provide you with an update following Sarah's occupational therapy session today.

SESSION SUMMARY:
Sarah had a productive 60-minute session today. We focused on upper limb strengthening and transfer training. She showed great motivation and improvement in her grip strength.

PROGRESS HIGHLIGHTS:
- Grip strength improved: Right 15kg (up from 12kg), Left 12kg (up from 10kg)
- Transfers now require moderate assistance (previously maximum assistance)
- Demonstrated good understanding of home exercise program

RECOMMENDATIONS:
- Continue daily home exercises (program attached)
- We recommend trialing a manual wheelchair - I'll send options this week
- Follow-up appointment scheduled for Tuesday, March 12th at 2:00 PM

NEXT STEPS:
- I'm referring Sarah to a physiotherapist for additional lower limb work
- We'll be ordering a wheelchair for her to trial at home
- Please let me know if you have any questions

Please feel free to reach out if you have any concerns or questions about Sarah's progress.

Warm regards,

Dr. Emily Carter
Occupational Therapist
Phone: (02) 9876 5432
Email: emily.carter@clinic.com.au`,
  }),
  
  referrals: () => ({
    type: "Nearby Specialists",
    content: [
      {
        title: "Bondi Physiotherapy Centre",
        description: "Experienced team specializing in pediatric and adult rehabilitation. Located 2.1km from patient's residence. Dr. James Mitchell - Senior Physiotherapist with 15 years experience.",
        link: "mailto:referrals@bondiphysio.com.au",
      },
      {
        title: "Eastern Suburbs Physio Clinic",
        description: "NDIS registered provider with aquatic therapy facilities. Located 3.5km away. Accepts Medicare and private health insurance.",
        link: "mailto:admin@easternsuburbsphysio.com.au",
      },
      {
        title: "Rose Bay Rehabilitation Services",
        description: "Multidisciplinary clinic with physio, OT, and speech pathology. Wheelchair accessible. Located 4.2km from patient.",
        link: "mailto:referrals@rosebayrehab.com.au",
      },
    ],
  }),
  
  order: () => ({
    type: "Equipment Options",
    content: [
      {
        title: "Karma Ergo 125 Manual Wheelchair - Budget Option",
        description: "Lightweight aluminum frame (11.5kg). Suitable for users 150-180cm, max weight 100kg. Includes attendant brakes, swing-away footrests. Price: $899",
        link: "https://aidacare.com.au/karma-ergo-125",
      },
      {
        title: "Invacare Action 3NG - Mid-Range",
        description: "Durable steel frame with adjustable armrests and footrests. Suitable for users 155-185cm, max weight 125kg. Extra cushioning for comfort. Price: $1,450",
        link: "https://aidacare.com.au/invacare-action-3ng",
      },
      {
        title: "Quickie Q7 Lightweight Wheelchair - Premium",
        description: "Ultra-lightweight (9.8kg) with quick-release wheels and adjustable center of gravity. Suitable for users 160-180cm, max weight 110kg. Available in multiple colors. Price: $2,299",
        link: "https://aidacare.com.au/quickie-q7",
      },
    ],
  }),

  store: (taskTitle) => ({
    type: "EMR Upload Confirmation",
    content: `DOCUMENT STORAGE CONFIRMATION

Document Type: Session Note
Patient: Sarah Anderson
MRN: MRN-2024-7892
Date: ${new Date().toLocaleDateString()}

FILE DETAILS:
- Document: OT_Session_Note_${new Date().toISOString().split('T')[0]}.pdf
- Size: 245 KB
- Pages: 3
- Generated: ${new Date().toLocaleString()}

UPLOAD STATUS: Ready to upload
Target System: Heidi EMR
Storage Location: Patient Records > Occupational Therapy > Session Notes

DOCUMENT CONTAINS:
✓ Clinical assessment findings
✓ Treatment interventions provided
✓ Progress measurements
✓ Goals and recommendations
✓ Clinician signature and credentials

Note: Document will be automatically indexed and searchable in the EMR system.

Click "Approve" to upload this document to the patient's medical record.`,
  }),

  book: (taskTitle) => ({
    type: "Appointment Booking",
    content: `APPOINTMENT SCHEDULING

Patient: Sarah Anderson
MRN: MRN-2024-7892
Service: Occupational Therapy Follow-up

PATIENT PREFERENCES:
- Preferred Day: Tuesday
- Preferred Time: Afternoon (2:00 PM - 4:00 PM)
- Next Available: Tuesday, March 12th at 2:00 PM

APPOINTMENT DETAILS:
Date: Tuesday, March 12, 2024
Time: 2:00 PM - 3:00 PM
Duration: 60 minutes
Clinician: Dr. Emily Carter, OT
Location: Room 3B, Ground Floor

PREPARATION REQUIRED:
- Bring current home exercise diary
- Wear comfortable clothing for movement assessment
- Parent/carer attendance encouraged

CALENDAR INVITE:
- Email confirmation will be sent to patient and parents
- SMS reminder 24 hours before appointment
- Calendar invitation attached

BILLING CODE: OT-60MIN-CONSULT
Medicare Item: 82150
Estimated Gap: $45.00

Click "Approve" to confirm this appointment booking.`,
  }),

  finance: (taskTitle) => ({
    type: "Invoice",
    content: `INVOICE

Invoice Number: INV-2024-${Math.floor(Math.random() * 10000)}
Date: ${new Date().toLocaleDateString()}
Due Date: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}

BILL TO:
Sarah Anderson
123 Beach Street
Bondi, NSW 2026

Patient MRN: MRN-2024-7892
Date of Birth: 15/05/1978

PROVIDER:
Dr. Emily Carter
Occupational Therapist
Provider Number: 2847562K

SERVICE DETAILS:
Date of Service: ${new Date().toLocaleDateString()}
Description: Occupational Therapy Consultation (60 minutes)
Medicare Item: 82150

CHARGES:
Service Fee: $180.00
Medicare Rebate: -$85.50
Private Health Rebate: -$49.50
----------------------------
Patient Responsibility: $45.00

PAYMENT DUE: $45.00

PAYMENT OPTIONS:
- Credit Card (Visa, Mastercard, Amex)
- EFTPOS
- Direct Debit
- Medicare Bulk Bill (if eligible)

Payment Terms: Due within 7 days
Late Payment Fee: $15.00 after 30 days

Questions? Contact our billing department:
Phone: (02) 9876 5432
Email: accounts@clinic.com.au`,
  }),

  reminder: (taskTitle) => ({
    type: "Appointment Reminder",
    content: `SMS REMINDER MESSAGE:

To: Sarah Anderson
Mobile: +61 412 345 678

---

Hi Sarah,

This is a reminder about your upcoming appointment:

📅 Tuesday, March 12, 2024
🕐 2:00 PM
👩‍⚕️ Dr. Emily Carter (Occupational Therapist)
📍 Room 3B, Ground Floor

Please bring:
• Your home exercise diary
• Comfortable clothing
• Parent/carer welcome to attend

Need to reschedule? 
Reply CANCEL or call (02) 9876 5432

We look forward to seeing you!

- Bondi Health Centre

---

ADDITIONAL EMAIL REMINDER:
Subject: Appointment Reminder - Tomorrow at 2:00 PM

This email reminder will also be sent 24 hours before the appointment with:
- Calendar attachment (.ics file)
- Directions and parking information
- Cancellation policy reminder
- Pre-appointment forms (if required)

Click "Approve" to send these reminders.`,
  }),
};

// ============================================================================

const typeIcons: Record<TaskType, typeof FileText> = {
  documentation: FileText,
  send: Mail,
  referrals: BookOpen,
  order: Package,
  store: FileText,
  book: Calendar,
  finance: FileText,
  reminder: Mail,
};

const typeToActionMap: Record<TaskType, ActionType> = {
  documentation: "documentation",
  send: "send",
  referrals: "referrals",
  order: "order",
  store: "store",
  book: "book",
  finance: "finance",
  reminder: "reminder",
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<Map<string, GeneratedTask>>(new Map());
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
        // Simulate network delay for mock data
        await new Promise((resolve) => setTimeout(resolve, 300));
        setPatient(MOCK_PATIENT);
      } else {
        // CONNECT YOUR BACKEND HERE:
        // Replace the URL with your actual backend endpoint
        const response = await fetch("http://localhost:5000/api/patient", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Add authentication headers if needed
          },
        });
        
        if (!response.ok) throw new Error("Failed to fetch patient");
        const data = await response.json();
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
  // BACKEND INTEGRATION POINT #2: Generate Content (Auto-triggered on task select)
  // ============================================================================
  // This function is automatically called when a task is selected
  // Replace with your actual API call to generate content based on the task
  // Expected request: { taskId: string, taskType: string }
  // Expected response: { type: string, content: string | Array<object> }
  const generateContentForTask = async (task: Task) => {
    setIsGenerating(true);

    try {
      const action = typeToActionMap[task.type];
      
      if (USE_MOCK_DATA) {
        // Simulate network delay for mock data
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        // Generate mock response based on task type
        const mockResponse = MOCK_ACTION_RESPONSES[action](task.title);
        
        setGeneratedTasks((prev) => {
          const newMap = new Map(prev);
          newMap.set(task.id, {
            taskId: task.id,
            content: mockResponse,
            editedContent: typeof mockResponse.content === "string" ? mockResponse.content : undefined,
            approved: false,
          });
          return newMap;
        });
      } else {
        // CONNECT YOUR BACKEND HERE:
        // Replace the URL with your actual backend endpoint
        // This endpoint should generate content based on the task type
        const response = await fetch("http://localhost:5000/api/tasks/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add authentication headers if needed:
            // "Authorization": `Bearer ${yourAuthToken}`,
          },
          body: JSON.stringify({
            taskId: task.id,
            taskType: task.type,
            taskDetails: task,
          }),
        });

        if (!response.ok) throw new Error("Failed to generate content");

        const data = await response.json();
        
        setGeneratedTasks((prev) => {
          const newMap = new Map(prev);
          newMap.set(task.id, {
            taskId: task.id,
            content: data,
            editedContent: typeof data.content === "string" ? data.content : undefined,
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
  // This function is called when user clicks "Execute All" after reviewing all tasks
  // This is where you actually send emails, save documents, etc. for all reviewed tasks
  // Replace with your actual API call to execute all tasks in batch
  // Expected request: Array<{ taskId: string, taskType: string, content: string | object }>
  // Expected response: success confirmation with results for each task
  const handleApprove = () => {
    if (!selectedTask) return;
    
    const currentTask = generatedTasks.get(selectedTask.id);
    if (!currentTask) return;
    
    const newApprovedState = !currentTask.approved;
    
    setGeneratedTasks(prev => new Map(prev).set(selectedTask.id, {
      ...currentTask,
      approved: newApprovedState
    }));
    
    toast({
      title: newApprovedState ? "Task Approved" : "Approval Cancelled",
      description: newApprovedState 
        ? "Task has been approved and is ready for execution."
        : "Task approval has been cancelled.",
      duration: 2000,
    });
  };

  const handleExecuteAll = async () => {
    const tasksToExecute = Array.from(generatedTasks.values()).filter(t => t.approved);
    
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
        // Simulate network delay for mock data
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Store count before clearing
        setExecutedTasksCount(tasksToExecute.length);

        // Remove executed tasks from the list
        setTasks((prev) => prev.filter((task) => !generatedTasks.has(task.id)));
        
        // Clear generated tasks
        setGeneratedTasks(new Map());

        // Show success modal
        setShowSuccessModal(true);
      } else {
        // CONNECT YOUR BACKEND HERE:
        // Replace the URL with your actual backend endpoint
        // This endpoint should execute all tasks in batch
        const tasksPayload = tasksToExecute.map((genTask) => ({
          taskId: genTask.taskId,
          taskType: tasks.find((t) => t.id === genTask.taskId)?.type,
          content: genTask.editedContent || genTask.content.content,
        }));

        const response = await fetch("http://localhost:5000/api/tasks/execute-batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Add authentication headers if needed:
            // "Authorization": `Bearer ${yourAuthToken}`,
          },
          body: JSON.stringify({
            tasks: tasksPayload,
            executedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) throw new Error("Failed to execute tasks");

        const result = await response.json();

        // Store count before clearing
        setExecutedTasksCount(tasksToExecute.length);

        // Remove executed tasks from the list
        setTasks((prev) => prev.filter((task) => !generatedTasks.has(task.id)));
        
        // Clear generated tasks
        setGeneratedTasks(new Map());

        // Show success modal
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

  const TypeIcon = selectedTask ? typeIcons[selectedTask.type] : FileText;
  const currentGenerated = selectedTask ? generatedTasks.get(selectedTask.id) : null;
  const totalTasksCount = tasks.length;
  const approvedTasksCount = Array.from(generatedTasks.values()).filter(t => t.approved).length;

  return (
    <div className="h-screen bg-gradient-to-br from-background to-muted/30 flex flex-col overflow-hidden">
      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md animate-scale-in">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 animate-fade-in">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-2xl">All Tasks Executed!</DialogTitle>
            <DialogDescription className="text-center text-base">
              Successfully completed {executedTasksCount} task{executedTasksCount !== 1 ? 's' : ''} for {patient?.name || 'the patient'}.
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
                    <p className="font-semibold text-foreground">{patient.name}</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">DOB</p>
                    <p className="text-sm text-foreground">{new Date(patient.dateOfBirth).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Session ID</p>
                    <p className="text-sm font-mono text-foreground">{patient.sessionId}</p>
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
                      const Icon = typeIcons[task.type];
                      return (
                        <button
                          key={task.id}
                          onClick={() => {
                            setSelectedTask(task);
                          }}
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

                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                            {task.description}
                          </p>

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
                        </div>
                      </div>
                    </div>
                    {selectedTask.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedTask.description}
                      </p>
                    )}
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
                              onChange={(e) => handleContentEdit(selectedTask.id, e.target.value)}
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
                          {currentGenerated.approved ? 'Approved' : 'Approve'}
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
