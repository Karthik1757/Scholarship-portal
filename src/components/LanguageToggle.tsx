import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Languages } from 'lucide-react';

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
      className="gap-2"
    >
      <Languages className="h-4 w-4" />
      <span className="font-medium">{language === 'en' ? 'English' : 'हिंदी'}</span>
    </Button>
  );
};
