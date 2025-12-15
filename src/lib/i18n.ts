// Simple i18n implementation for English and Hindi
export type Language = 'en' | 'hi';

export const translations = {
  en: {
    // Navigation
    home: 'Home',
    dashboard: 'Dashboard',
    scholarships: 'Scholarships',
    profile: 'Profile',
    logout: 'Logout',
    
    // Auth
    signIn: 'Sign In',
    signUp: 'Sign Up',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    
    // Hero
    heroTitle: 'Find Your Perfect Scholarship',
    heroSubtitle: 'AI-powered matching for Indian students. Discover opportunities tailored to your profile.',
    getStarted: 'Get Started',
    
    // Profile Wizard
    welcomeTitle: "Let's Find You Some Scholarships!",
    welcomeSubtitle: 'Answer a few questions to get personalized matches.',
    step1Title: 'Academic Information',
    step2Title: 'Personal Details',
    step3Title: 'Financial Information',
    next: 'Next',
    previous: 'Previous',
    finish: 'Finish',
    
    // Profile fields
    fullName: 'Full Name',
    phone: 'Phone Number',
    state: 'State',
    category: 'Category',
    gender: 'Gender',
    familyIncome: 'Annual Family Income (₹)',
    educationLevel: 'Education Level',
    fieldOfStudy: 'Field of Study',
    currentYear: 'Current Year',
    marks: 'Percentage/CGPA',
    
    // Dashboard
    topMatches: 'Your Top Scholarship Matches',
    upcomingDeadlines: 'Upcoming Deadlines',
    profileCompleteness: 'Profile Completeness',
    viewAll: 'View All',
    applyNow: 'Apply Now',
    
    // Scholarship
    deadline: 'Deadline',
    amount: 'Award Amount',
    source: 'Source',
    eligibility: 'Eligibility',
    whyMatch: 'Why You Match',
    applicationSteps: 'Application Steps',
    requiredDocuments: 'Required Documents',
  },
  hi: {
    // Navigation
    home: 'होम',
    dashboard: 'डैशबोर्ड',
    scholarships: 'छात्रवृत्ति',
    profile: 'प्रोफ़ाइल',
    logout: 'लॉग आउट',
    
    // Auth
    signIn: 'साइन इन करें',
    signUp: 'साइन अप करें',
    email: 'ईमेल',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड की पुष्टि करें',
    alreadyHaveAccount: 'पहले से खाता है?',
    dontHaveAccount: 'खाता नहीं है?',
    
    // Hero
    heroTitle: 'अपनी परफेक्ट स्कॉलरशिप खोजें',
    heroSubtitle: 'भारतीय छात्रों के लिए AI-संचालित मैचिंग। अपनी प्रोफ़ाइल के अनुसार अवसर खोजें।',
    getStarted: 'शुरू करें',
    
    // Profile Wizard
    welcomeTitle: 'आइए आपके लिए छात्रवृत्ति खोजें!',
    welcomeSubtitle: 'व्यक्तिगत मैच पाने के लिए कुछ प्रश्नों के उत्तर दें।',
    step1Title: 'शैक्षणिक जानकारी',
    step2Title: 'व्यक्तिगत विवरण',
    step3Title: 'वित्तीय जानकारी',
    next: 'अगला',
    previous: 'पिछला',
    finish: 'समाप्त',
    
    // Profile fields
    fullName: 'पूरा नाम',
    phone: 'फोन नंबर',
    state: 'राज्य',
    category: 'श्रेणी',
    gender: 'लिंग',
    familyIncome: 'वार्षिक पारिवारिक आय (₹)',
    educationLevel: 'शिक्षा स्तर',
    fieldOfStudy: 'अध्ययन क्षेत्र',
    currentYear: 'वर्तमान वर्ष',
    marks: 'प्रतिशत/CGPA',
    
    // Dashboard
    topMatches: 'आपके शीर्ष छात्रवृत्ति मैच',
    upcomingDeadlines: 'आगामी समय सीमा',
    profileCompleteness: 'प्रोफ़ाइल पूर्णता',
    viewAll: 'सभी देखें',
    applyNow: 'अभी आवेदन करें',
    
    // Scholarship
    deadline: 'समय सीमा',
    amount: 'पुरस्कार राशि',
    source: 'स्रोत',
    eligibility: 'पात्रता',
    whyMatch: 'आप क्यों मैच करते हैं',
    applicationSteps: 'आवेदन के चरण',
    requiredDocuments: 'आवश्यक दस्तावेज',
  },
};

export const useTranslation = (language: Language = 'en') => {
  return {
    t: (key: keyof typeof translations.en) => translations[language][key],
    language,
  };
};
