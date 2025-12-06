import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSuspenseQuery, useMutation } from '@tanstack/react-query';
import { useAction } from 'convex/react';
import { convexQuery, useConvexMutation } from '@convex-dev/react-query';
import { PlusCircle, Trash2, Sparkles, Save } from 'lucide-react';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResumePreview } from '@/components/ResumePreview';
import { useToast } from '@/hooks/use-toast';
import { resumeFormSchema, type ResumeFormData } from '@/lib/schemas/resume';
import { api } from '../../convex/_generated/api';

interface ResumeFormProps {
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    if (firstIssue) return firstIssue.message;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Validation error';
}

export function ResumeForm({ user }: ResumeFormProps) {
  const [activeTab, setActiveTab] = useState('form');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishingField, setPolishingField] = useState<string | null>(null);
  const { toast } = useToast();

  // Load existing resume
  const { data: existingResume } = useSuspenseQuery(
    convexQuery(api.resumes.getByWorkosUserId, { workosUserId: user.id })
  );

  // Save mutation
  const { mutate: saveResume, isPending: isSaving } = useMutation({
    mutationFn: useConvexMutation(api.resumes.upsert),
    onSuccess: () => {
      toast({
        title: 'Resume saved',
        description: 'Your resume has been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving resume',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  // AI polish action
  const polishWithAI = useAction(api.resumes.polishWithAI);

  // Initialize form with existing data or defaults
  const form = useForm<ResumeFormData>({
    defaultValues: {
      personalInfo: {
        name: existingResume?.personalInfo.name ?? [user.firstName, user.lastName].filter(Boolean).join(' ') ?? '',
        email: existingResume?.personalInfo.email ?? user.email,
        phone: existingResume?.personalInfo.phone ?? '',
        location: existingResume?.personalInfo.location ?? '',
        linkedin: existingResume?.personalInfo.linkedin ?? '',
      },
      summary: existingResume?.summary ?? '',
      workExperience: existingResume?.workExperience.length
        ? existingResume.workExperience.map((exp) => ({
            id: exp.id,
            company: exp.company ?? '',
            position: exp.position ?? '',
            startDate: exp.startDate ?? '',
            endDate: exp.endDate ?? '',
            description: exp.description ?? '',
            achievements: exp.achievements ?? '',
          }))
        : [{ id: nanoid(), company: '', position: '', startDate: '', endDate: '', description: '', achievements: '' }],
      education: existingResume?.education.length
        ? existingResume.education.map((edu) => ({
            id: edu.id,
            institution: edu.institution ?? '',
            degree: edu.degree ?? '',
            field: edu.field ?? '',
            graduationDate: edu.graduationDate ?? '',
            description: edu.description ?? '',
          }))
        : [{ id: nanoid(), institution: '', degree: '', field: '', graduationDate: '', description: '' }],
      skills: existingResume?.skills ?? '',
    },
    validators: {
      onBlur: resumeFormSchema,
      onSubmit: resumeFormSchema,
    },
  });

  const checkRateLimit = (): boolean => {
    const storageKey = '_resume_polish_cache';
    const maxRequests = 5;
    const timeWindow = 60 * 1000; // 1 minute in milliseconds

    try {
      const stored = localStorage.getItem(storageKey);
      const timestamps: number[] = stored ? JSON.parse(stored) : [];

      const now = Date.now();

      const recentTimestamps = timestamps.filter((ts) => now - ts < timeWindow);

      if (recentTimestamps.length >= maxRequests) {
        return false;
      }

      recentTimestamps.push(now);
      localStorage.setItem(storageKey, JSON.stringify(recentTimestamps));

      return true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return true; // Allow request if localStorage fails
    }
  };

  const handleSave = () => {
    saveResume({ workosUserId: user.id, ...form.state.values });
  };

  const polishSummaryWithAI = async () => {
    if (!checkRateLimit()) {
      toast({
        title: 'Rate limit reached',
        description: 'You have reached your limit. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    setIsPolishing(true);
    setPolishingField('summary');
    try {
      const values = form.state.values;
      const result = await polishWithAI({
        type: 'summary',
        currentText: values.summary,
        context: {
          personalInfo: {
            name: values.personalInfo.name,
            location: values.personalInfo.location,
          },
          workExperience: values.workExperience.map((exp) => ({
            company: exp.company,
            position: exp.position,
            startDate: exp.startDate,
            endDate: exp.endDate,
            description: exp.description,
            achievements: exp.achievements,
          })),
          skills: values.skills,
        },
      });
      form.setFieldValue('summary', result.polishedText);
      toast({
        title: 'Summary polished',
        description: 'Your professional summary has been enhanced.',
      });
    } catch (error) {
      console.error('Error polishing summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to polish summary. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPolishing(false);
      setPolishingField(null);
    }
  };

  const polishWorkExperienceWithAI = async (experienceId: string, index: number) => {
    if (!checkRateLimit()) {
      toast({
        title: 'Rate limit reached',
        description: 'You have reached your limit. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    const experience = form.state.values.workExperience[index];
    if (!experience) return;

    setIsPolishing(true);
    setPolishingField(`work-${experienceId}`);
    try {
      const result = await polishWithAI({
        type: 'workExperience',
        currentText: experience.description,
        context: {
          company: experience.company,
          position: experience.position,
          achievements: experience.achievements,
        },
      });
      form.setFieldValue(`workExperience[${index}].description`, result.polishedText);
      toast({
        title: 'Description polished',
        description: 'Your job description has been enhanced.',
      });
    } catch (error) {
      console.error('Error polishing description:', error);
      toast({
        title: 'Error',
        description: 'Failed to polish description. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPolishing(false);
      setPolishingField(null);
    }
  };

  const polishEducationWithAI = async (educationId: string, index: number) => {
    if (!checkRateLimit()) {
      toast({
        title: 'Rate limit reached',
        description: 'You have reached your limit. Please try again later.',
        variant: 'destructive',
      });
      return;
    }

    const education = form.state.values.education[index];
    if (!education) return;

    setIsPolishing(true);
    setPolishingField(`edu-${educationId}`);
    try {
      const result = await polishWithAI({
        type: 'education',
        currentText: education.description,
        context: {
          institution: education.institution,
          degree: education.degree,
          field: education.field,
        },
      });
      form.setFieldValue(`education[${index}].description`, result.polishedText);
      toast({
        title: 'Description polished',
        description: 'Your education description has been enhanced.',
      });
    } catch (error) {
      console.error('Error polishing description:', error);
      toast({
        title: 'Error',
        description: 'Failed to polish description. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPolishing(false);
      setPolishingField(null);
    }
  };

  const addWorkExperience = () => {
    const current = form.state.values.workExperience;
    form.setFieldValue('workExperience', [
      ...current,
      { id: nanoid(), company: '', position: '', startDate: '', endDate: '', description: '', achievements: '' },
    ]);
  };

  const removeWorkExperience = (index: number) => {
    const current = form.state.values.workExperience;
    if (current.length > 1) {
      form.setFieldValue(
        'workExperience',
        current.filter((_, i) => i !== index)
      );
    }
  };

  const addEducation = () => {
    const current = form.state.values.education;
    form.setFieldValue('education', [
      ...current,
      { id: nanoid(), institution: '', degree: '', field: '', graduationDate: '', description: '' },
    ]);
  };

  const removeEducation = (index: number) => {
    const current = form.state.values.education;
    if (current.length > 1) {
      form.setFieldValue(
        'education',
        current.filter((_, i) => i !== index)
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="form">Form</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="form">
          <div className="space-y-8">
            {/* Personal Information */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <form.Field name="personalInfo.name">
                      {(field) => (
                        <>
                          <Input
                            id="name"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="John Doe"
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-sm text-destructive">
                              {getErrorMessage(field.state.meta.errors[0])}
                            </p>
                          )}
                        </>
                      )}
                    </form.Field>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <form.Field name="personalInfo.email">
                      {(field) => (
                        <>
                          <Input
                            id="email"
                            type="email"
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="john.doe@example.com"
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-sm text-destructive">
                              {getErrorMessage(field.state.meta.errors[0])}
                            </p>
                          )}
                        </>
                      )}
                    </form.Field>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <form.Field name="personalInfo.phone">
                      {(field) => (
                        <>
                          <Input
                            id="phone"
                            value={field.state.value || ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="(123) 456-7890"
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-sm text-destructive">
                              {getErrorMessage(field.state.meta.errors[0])}
                            </p>
                          )}
                        </>
                      )}
                    </form.Field>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <form.Field name="personalInfo.location">
                      {(field) => (
                        <>
                          <Input
                            id="location"
                            value={field.state.value || ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="City, State"
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-sm text-destructive">
                              {getErrorMessage(field.state.meta.errors[0])}
                            </p>
                          )}
                        </>
                      )}
                    </form.Field>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="linkedin">LinkedIn (optional)</Label>
                    <form.Field name="personalInfo.linkedin">
                      {(field) => (
                        <>
                          <Input
                            id="linkedin"
                            value={field.state.value || ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="linkedin.com/in/johndoe"
                          />
                          {field.state.meta.errors.length > 0 && (
                            <p className="text-sm text-destructive">
                              {getErrorMessage(field.state.meta.errors[0])}
                            </p>
                          )}
                        </>
                      )}
                    </form.Field>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Summary */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Professional Summary</h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={polishSummaryWithAI}
                    disabled={isPolishing}
                    className="flex items-center gap-1"
                  >
                    <Sparkles className="h-4 w-4" />
                    {polishingField === 'summary' ? 'Polishing...' : 'Polish with AI'}
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">
                    Write a concise summary of your professional background (3-5 sentences)
                  </Label>
                  <form.Field name="summary">
                    {(field) => (
                      <>
                        <Textarea
                          id="summary"
                          value={field.state.value || ''}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="Experienced software developer with 5+ years of expertise in web development..."
                          className="min-h-[100px]"
                        />
                        {field.state.meta.errors.length > 0 && (
                          <p className="text-sm text-destructive">
                            {getErrorMessage(field.state.meta.errors[0])}
                          </p>
                        )}
                      </>
                    )}
                  </form.Field>
                  <p className="text-sm text-muted-foreground">
                    Tip: Include relevant keywords from the job description to improve ATS matching.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Work Experience */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Work Experience</h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addWorkExperience}
                    className="flex items-center gap-1"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add Experience
                  </Button>
                </div>

                {form.state.values.workExperience.map((experience, index) => (
                  <div
                    key={experience.id}
                    className="mb-6 pb-6 border-b last:border-b-0 last:pb-0 last:mb-0"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium">Experience {index + 1}</h3>
                      {form.state.values.workExperience.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeWorkExperience(index)}
                          className="text-destructive hover:text-destructive/90"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`company-${experience.id}`}>Company</Label>
                        <form.Field name={`workExperience[${index}].company`}>
                          {(field) => (
                            <>
                              <Input
                                id={`company-${experience.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="Company Name"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`position-${experience.id}`}>Position</Label>
                        <form.Field name={`workExperience[${index}].position`}>
                          {(field) => (
                            <>
                              <Input
                                id={`position-${experience.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="Job Title"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`startDate-${experience.id}`}>Start Date</Label>
                        <form.Field name={`workExperience[${index}].startDate`}>
                          {(field) => (
                            <>
                              <Input
                                id={`startDate-${experience.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="MM/YYYY"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`endDate-${experience.id}`}>End Date</Label>
                        <form.Field name={`workExperience[${index}].endDate`}>
                          {(field) => (
                            <>
                              <Input
                                id={`endDate-${experience.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="MM/YYYY or Present"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor={`description-${experience.id}`}>Job Description</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => polishWorkExperienceWithAI(experience.id, index)}
                            disabled={isPolishing}
                            className="flex items-center gap-1"
                          >
                            <Sparkles className="h-3 w-3" />
                            {polishingField === `work-${experience.id}`
                              ? 'Polishing...'
                              : 'Polish with AI'}
                          </Button>
                        </div>
                        <form.Field name={`workExperience[${index}].description`}>
                          {(field) => (
                            <>
                              <Textarea
                                id={`description-${experience.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="Describe your role and responsibilities..."
                                className="min-h-[80px]"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`achievements-${experience.id}`}>
                          Key Achievements (use bullet points)
                        </Label>
                        <form.Field name={`workExperience[${index}].achievements`}>
                          {(field) => (
                            <>
                              <Textarea
                                id={`achievements-${experience.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder={`• Increased sales by 20%
• Led a team of 5 developers
• Implemented new system that reduced costs by 15%`}
                                className="min-h-[100px]"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                        <p className="text-sm text-muted-foreground">
                          Tip: Use quantifiable achievements with metrics when possible.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Education</h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEducation}
                    className="flex items-center gap-1"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add Education
                  </Button>
                </div>

                {form.state.values.education.map((education, index) => (
                  <div
                    key={education.id}
                    className="mb-6 pb-6 border-b last:border-b-0 last:pb-0 last:mb-0"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-medium">Education {index + 1}</h3>
                      {form.state.values.education.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEducation(index)}
                          className="text-destructive hover:text-destructive/90"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`institution-${education.id}`}>Institution</Label>
                        <form.Field name={`education[${index}].institution`}>
                          {(field) => (
                            <>
                              <Input
                                id={`institution-${education.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="University Name"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`degree-${education.id}`}>Degree</Label>
                        <form.Field name={`education[${index}].degree`}>
                          {(field) => (
                            <>
                              <Input
                                id={`degree-${education.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="Bachelor of Science"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`field-${education.id}`}>Field of Study</Label>
                        <form.Field name={`education[${index}].field`}>
                          {(field) => (
                            <>
                              <Input
                                id={`field-${education.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="Computer Science"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`graduationDate-${education.id}`}>Graduation Date</Label>
                        <form.Field name={`education[${index}].graduationDate`}>
                          {(field) => (
                            <>
                              <Input
                                id={`graduationDate-${education.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="MM/YYYY"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <div className="flex justify-between items-center">
                          <Label htmlFor={`eduDescription-${education.id}`}>
                            Additional Information (optional)
                          </Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => polishEducationWithAI(education.id, index)}
                            disabled={isPolishing}
                            className="flex items-center gap-1"
                          >
                            <Sparkles className="h-3 w-3" />
                            {polishingField === `edu-${education.id}`
                              ? 'Polishing...'
                              : 'Polish with AI'}
                          </Button>
                        </div>
                        <form.Field name={`education[${index}].description`}>
                          {(field) => (
                            <>
                              <Textarea
                                id={`eduDescription-${education.id}`}
                                value={field.state.value || ''}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                placeholder="Relevant coursework, honors, activities..."
                                className="min-h-[80px]"
                              />
                              {field.state.meta.errors.length > 0 && (
                                <p className="text-sm text-destructive">
                                  {getErrorMessage(field.state.meta.errors[0])}
                                </p>
                              )}
                            </>
                          )}
                        </form.Field>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold mb-4">Skills</h2>
                <div className="space-y-2">
                  <Label htmlFor="skills">
                    List your relevant skills (separate with commas or use bullet points)
                  </Label>
                  <form.Field name="skills">
                    {(field) => (
                      <>
                        <Textarea
                          id="skills"
                          value={field.state.value || ''}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="JavaScript, React, Node.js, Project Management, Team Leadership"
                          className="min-h-[100px]"
                        />
                        {field.state.meta.errors.length > 0 && (
                          <p className="text-sm text-destructive">
                            {getErrorMessage(field.state.meta.errors[0])}
                          </p>
                        )}
                      </>
                    )}
                  </form.Field>
                  <p className="text-sm text-muted-foreground">
                    Tip: Include both technical and soft skills relevant to the position.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
                className="px-8"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Resume'}
              </Button>
              <Button size="lg" onClick={() => setActiveTab('preview')} className="px-8">
                Preview Resume
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="preview">
          <ResumePreview formData={form.state.values} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
