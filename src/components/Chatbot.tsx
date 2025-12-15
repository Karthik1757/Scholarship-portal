import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, X, Send, Bot, Loader2, Minimize2, Maximize2, ChevronRight } from 'lucide-react';
import { sendMessageToGemini, ChatMessage } from '@/lib/gemini';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';

// Types for internal state
type FlowState = 
  | 'idle' 
  | 'collecting_name' 
  | 'collecting_state'
  | 'collecting_category'
  | 'collecting_gender'
  | 'collecting_education' 
  | 'collecting_field'
  | 'collecting_year'
  | 'collecting_marks' 
  | 'collecting_income' 
  | 'searching';

interface UserInputs {
  name: string;
  state: string;
  category: string;
  gender: string;
  education: string;
  fieldOfStudy: string;
  currentYear: string;
  marks: string;
  income: string;
}

interface ExtendedChatMessage extends ChatMessage {
  type?: 'text' | 'scholarship-list';
  scholarships?: any[];
}

const FAQs = [
  "Find Scholarships for me 🎓",
  "How do I apply?",
  "What documents are needed?",
  "Is there an income limit?"
];

export function Chatbot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<ExtendedChatMessage[]>([
    { role: 'model', text: "Hi there! 👋 I'm your Scholar Assistant. I can help you find scholarships or answer your questions." }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Flow State
  const [flowStatus, setFlowStatus] = useState<FlowState>('idle');
  const [userInputs, setUserInputs] = useState<UserInputs>({ 
    name: '', 
    state: '',
    category: '',
    gender: '',
    education: '', 
    fieldOfStudy: '',
    currentYear: '',
    marks: '', 
    income: '' 
  });

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) setTimeout(scrollToBottom, 100);
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // --- Scholarship Matching Logic (Client Side) ---
  
  // Helper to handle both string and array inputs for rules
  const checkInclusion = (ruleValue: any, userValue: string) => {
      if (!ruleValue) return true; // No rule defined means eligible
      if (Array.isArray(ruleValue)) {
          return ruleValue.length === 0 || ruleValue.some(v => v.toLowerCase() === userValue.toLowerCase());
      }
      // Handle string value
      return String(ruleValue).toLowerCase() === String(userValue).toLowerCase();
  };

  const checkEligibility = (scholarship: any, criteria: UserInputs) => {
    // Parse rules
    let rules = scholarship.eligibility_rules;
    if (typeof rules === 'string') {
      try { rules = JSON.parse(rules); } catch { return true; }
    }
    if (!rules) return true;

    // Helper to find value in rules object case-insensitively
    const findVal = (keys: string[]) => {
        const objKeys = Object.keys(rules);
        for (const k of keys) {
            if (rules[k] !== undefined && rules[k] !== null && rules[k] !== '') return rules[k];
            const found = objKeys.find(ok => ok.toLowerCase() === k.toLowerCase());
            if (found && rules[found] !== undefined && rules[found] !== null && rules[found] !== '') return rules[found];
        }
        return undefined;
    };

    // 1. Marks Check
    const minMarks = findVal(['minMarks', 'min_marks', 'marks', 'percentage']);
    if (minMarks) {
        const userMarks = parseFloat(criteria.marks);
        const reqMarks = typeof minMarks === 'string' ? parseFloat(minMarks.replace(/[^0-9.]/g, '')) : Number(minMarks);
        if (!isNaN(userMarks) && !isNaN(reqMarks) && userMarks < reqMarks) return false;
    }

    // 2. Income Check
    const maxIncome = findVal(['maxIncome', 'max_income', 'familyIncome', 'income']);
    if (maxIncome) {
        const userIncome = parseFloat(criteria.income);
        const reqIncome = typeof maxIncome === 'string' ? parseFloat(maxIncome.replace(/[^0-9.]/g, '')) : Number(maxIncome);
        if (!isNaN(userIncome) && !isNaN(reqIncome) && userIncome > reqIncome) return false;
    }

    // 3. Education Level Check
    const eduLevels = findVal(['educationLevels', 'education_level', 'educationLevel']);
    if (eduLevels) {
        if (!checkInclusion(eduLevels, criteria.education)) return false;
    }

    // 4. State Check
    const states = findVal(['states', 'state', 'domicile']);
    if (states) {
        if (!checkInclusion(states, criteria.state)) return false;
    }

    // 5. Category Check
    const categories = findVal(['categories', 'category', 'caste']);
    if (categories) {
        if (!checkInclusion(categories, criteria.category)) return false;
    }

    // 6. Gender Check
    const gender = findVal(['gender', 'sex']);
    if (gender && gender !== 'Any') {
        if (gender.toLowerCase() !== criteria.gender.toLowerCase()) return false;
    }

    return true;
  };

  const findScholarships = async (inputs: UserInputs) => {
    setIsLoading(true);
    try {
        // 1. Get IDs of scholarships the user has already applied for
        let appliedScholarshipIds: string[] = [];
        if (user) {
            const { data: applications } = await supabase
                .from('scholarship_applications')
                .select('scholarship_id')
                .eq('user_id', user.id);
            
            if (applications) {
                appliedScholarshipIds = applications.map(app => app.scholarship_id);
            }
        }

        // 2. Fetch active scholarships
        const { data: scholarships, error } = await supabase
            .from('scholarships')
            .select('*')
            .gt('deadline', new Date().toISOString()) // Only future deadlines
            .limit(100); // Fetch more to filter

        if (error) throw error;

        // 3. Filter matches
        const matches = scholarships
            .filter(s => !appliedScholarshipIds.includes(s.id)) // Exclude applied
            .filter(s => checkEligibility(s, inputs)) // Check eligibility
            .slice(0, 3); // Top 3

        if (matches.length > 0) {
            const msg: ExtendedChatMessage = {
                role: 'model',
                text: `Great news, ${inputs.name}! Based on your profile, I found ${matches.length} new scholarships for you:`,
                type: 'scholarship-list',
                scholarships: matches
            };
            setMessages(prev => [...prev, msg]);
        } else {
            setMessages(prev => [...prev, {
                role: 'model',
                text: `I checked our database, ${inputs.name}, but I couldn't find any new exact matches for your criteria right now. \n\n(Note: I hid scholarships you've already applied for). You can explore all available scholarships on the dashboard!`
            }]);
        }

    } catch (err) {
        console.error("Error finding scholarships:", err);
        setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error while searching the database. Please try again later." }]);
    } finally {
        setIsLoading(false);
        setFlowStatus('idle'); // Reset flow
    }
  };

  // --- Conversation Flow Handlers ---

  const startScholarshipFlow = () => {
    setFlowStatus('collecting_name');
    const msg: ExtendedChatMessage = { role: 'model', text: "That's a great idea! Let's find the perfect scholarship for you. \n\nFirst, may I know your **full name**?" };
    setMessages(prev => [...prev, msg]);
  };

  const handleFlowInput = (text: string) => {
    const newMessages = [...messages, { role: 'user', text } as ExtendedChatMessage];
    setMessages(newMessages);
    setInputValue('');

    switch (flowStatus) {
        case 'collecting_name':
            setUserInputs(prev => ({ ...prev, name: text }));
            setFlowStatus('collecting_state');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: `Nice to meet you, ${text}! 👋\n\nWhich **State** are you from? (e.g., Maharashtra, Delhi, Karnataka)` 
                }]);
            }, 500);
            break;

        case 'collecting_state':
            setUserInputs(prev => ({ ...prev, state: text }));
            setFlowStatus('collecting_category');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: "Got it. What is your **Category**? (General, OBC, SC, ST, EWS)" 
                }]);
            }, 500);
            break;

        case 'collecting_category':
            setUserInputs(prev => ({ ...prev, category: text }));
            setFlowStatus('collecting_gender');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: "What is your **Gender**? (Male, Female, Other)" 
                }]);
            }, 500);
            break;

        case 'collecting_gender':
            setUserInputs(prev => ({ ...prev, gender: text }));
            setFlowStatus('collecting_education');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: "What is your current **Education Level**? (e.g., Class 10, Class 12, Bachelors, Masters)" 
                }]);
            }, 500);
            break;

        case 'collecting_education':
            setUserInputs(prev => ({ ...prev, education: text }));
            setFlowStatus('collecting_field');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: "What is your **Field of Study**? (e.g., Science, Arts, Engineering, Commerce)" 
                }]);
            }, 500);
            break;

        case 'collecting_field':
            setUserInputs(prev => ({ ...prev, fieldOfStudy: text }));
            setFlowStatus('collecting_year');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: "Which **Year** are you currently in? (e.g., 1, 2, 3, 4)" 
                }]);
            }, 500);
            break;

        case 'collecting_year':
            setUserInputs(prev => ({ ...prev, currentYear: text }));
            setFlowStatus('collecting_marks');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: "Great! What is your previous year's **Percentage or CGPA**? (e.g., 85 or 8.5)" 
                }]);
            }, 500);
            break;

        case 'collecting_marks':
            setUserInputs(prev => ({ ...prev, marks: text.replace(/[^0-9.]/g, '') }));
            setFlowStatus('collecting_income');
            setTimeout(() => {
                setMessages(prev => [...prev, { 
                    role: 'model', 
                    text: "Almost done! What is your **Annual Family Income** in Rupees? (e.g., 500000)" 
                }]);
            }, 500);
            break;

        case 'collecting_income':
            const finalInputs = { ...userInputs, income: text.replace(/[^0-9]/g, '') };
            setUserInputs(finalInputs);
            setFlowStatus('searching');
            setMessages(prev => [...prev, { role: 'model', text: "Thank you! Analyzing your profile and checking eligibility... 🔍" }]);
            findScholarships(finalInputs);
            break;
    }
  };

  // --- General Handlers ---

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    if (flowStatus !== 'idle') {
        handleFlowInput(inputValue.trim());
        return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    
    const newMessages = [...messages, { role: 'user', text: userMessage } as ExtendedChatMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Check for keywords to trigger flow manually
    if (userMessage.toLowerCase().includes('find scholarship') || userMessage.toLowerCase().includes('recommend')) {
        setIsLoading(false);
        startScholarshipFlow();
        return;
    }

    // Default AI Chat
    const responseText = await sendMessageToGemini(messages, userMessage);
    setMessages([...newMessages, { role: 'model', text: responseText }]);
    setIsLoading(false);
  };

  const handleFAQClick = (faq: string) => {
      if (faq.includes("Find Scholarships")) {
          startScholarshipFlow();
      } else {
          setInputValue(faq);
          // Trigger send immediately (simulated)
          const newMessages = [...messages, { role: 'user', text: faq } as ExtendedChatMessage];
          setMessages(newMessages);
          setIsLoading(true);
          sendMessageToGemini(messages, faq).then(res => {
              setMessages([...newMessages, { role: 'model', text: res }]);
              setIsLoading(false);
          });
      }
  };

  const toggleChat = () => setIsOpen(!isOpen);
  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={cn(
      "fixed z-50 transition-all duration-300 ease-in-out",
      isOpen 
        ? isExpanded 
          ? "inset-0 md:bottom-4 md:right-4 md:left-auto md:top-auto md:w-[600px] md:h-[80vh]" 
          : "inset-0 md:inset-auto md:bottom-6 md:right-6" 
        : "bottom-6 right-6"
    )}>
      
      {/* Chat Window */}
      {isOpen && (
        <Card className={cn(
          "flex flex-col shadow-2xl border-primary/20 h-full md:h-[600px] md:w-[400px] transition-all duration-300",
          isExpanded && "md:w-full md:h-full"
        )}>
          <CardHeader className="p-4 border-b bg-primary text-primary-foreground rounded-t-lg flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-white/20 rounded-full">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base">Scholar Assistant</CardTitle>
                <p className="text-xs text-primary-foreground/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-primary-foreground hover:bg-white/20 hidden md:flex"
                onClick={toggleExpand}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-primary-foreground hover:bg-white/20"
                onClick={toggleChat}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden bg-muted/30 relative flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* FAQ Section at the top if history is short */}
                {messages.length === 1 && flowStatus === 'idle' && (
                    <div className="grid grid-cols-1 gap-2 mb-4">
                        <p className="text-xs text-muted-foreground mb-1 ml-1">Frequently Asked Questions:</p>
                        {FAQs.map((faq, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleFAQClick(faq)}
                                className="text-left text-sm bg-background hover:bg-primary/5 border border-border/50 rounded-lg p-2.5 transition-colors flex items-center justify-between group"
                            >
                                {faq}
                                <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                            </button>
                        ))}
                    </div>
                )}

                {messages.map((msg, idx) => (
                  <div key={idx} className={cn("flex flex-col gap-1", msg.role === 'user' ? "items-end" : "items-start")}>
                      <div 
                        className={cn(
                          "flex w-max max-w-[85%] flex-col gap-2 rounded-lg px-3 py-2 text-sm shadow-sm",
                          msg.role === 'user' 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-card border text-foreground"
                        )}
                      >
                        {msg.role === 'user' ? (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        ) : (
                          <div className="markdown-content prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* Render Scholarship Cards if present */}
                      {msg.type === 'scholarship-list' && msg.scholarships && (
                          <div className="flex flex-col gap-2 w-full max-w-[90%] mt-2">
                              {msg.scholarships.map(s => (
                                  <div 
                                    key={s.id} 
                                    className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                                    onClick={() => navigate(`/scholarship/${s.id}`)}
                                  >
                                      <div className="flex justify-between items-start mb-1">
                                          <h4 className="font-semibold text-sm text-primary group-hover:underline line-clamp-1">{s.title}</h4>
                                          <Badge variant="secondary" className="text-[10px] h-5">{s.source}</Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{s.description}</p>
                                      <div className="flex items-center justify-between text-xs">
                                          <span className="font-medium text-green-600">₹{s.amount?.toLocaleString() ?? 'N/A'}</span>
                                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">View <ChevronRight className="h-3 w-3 ml-1"/></Button>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm bg-card border text-foreground">
                    <div className="flex gap-1 items-center h-5">
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
            </div>
          </CardContent>

          <CardFooter className="p-3 border-t bg-background shrink-0">
            <form 
              onSubmit={handleSendMessage}
              className="flex w-full items-center gap-2"
            >
              <Input
                ref={inputRef}
                placeholder={flowStatus === 'idle' ? "Ask a question..." : "Type your answer..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 focus-visible:ring-primary"
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  "transition-all duration-200", 
                  inputValue.trim() ? "bg-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {/* Floating Toggle Button */}
      {!isOpen && (
        <Button
          onClick={toggleChat}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-transform hover:scale-105 animate-in zoom-in duration-300 relative"
        >
          <MessageCircle className="h-7 w-7" />
          <span className="sr-only">Open Chat</span>
          {/* Notification dot if idle */}
          <span className="absolute top-0 right-0 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
          </span>
        </Button>
      )}
    </div>
  );
}
