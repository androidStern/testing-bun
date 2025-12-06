import { useState, useRef } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type {
  WorkExperience,
  Education,
  ResumeFormData,
} from '@/lib/schemas/resume';

interface ResumePreviewProps {
  formData: ResumeFormData;
}

export function ResumePreview({ formData }: ResumePreviewProps) {
  const [activeView, setActiveView] = useState('preview');
  const resumeRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const formatAchievements = (achievements: string | undefined) => {
    if (!achievements) return [];

    // Split by new line or bullet points
    return achievements
      .split(/\n|•/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .map((item) => (item.startsWith('•') ? item : `• ${item}`));
  };

  const formatSkills = (skills: string | undefined) => {
    if (!skills) return [];

    // Split by commas, new lines, or bullet points
    return skills
      .split(/,|\n|•/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const printResume = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && resumeRef.current) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${formData.personalInfo.name} - Resume</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
              }
              h1, h2, h3 {
                color: #111;
                margin-top: 20px;
                margin-bottom: 10px;
              }
              h1 {
                font-size: 24px;
                text-align: center;
                margin-bottom: 5px;
              }
              .contact-info {
                text-align: center;
                margin-bottom: 20px;
                font-size: 14px;
              }
              .section {
                margin-bottom: 20px;
              }
              .section-title {
                font-size: 18px;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
                margin-bottom: 10px;
              }
              .job-title, .education-title {
                font-weight: bold;
                margin-bottom: 0;
              }
              .job-company, .education-institution {
                font-weight: bold;
              }
              .job-date, .education-date {
                float: right;
              }
              .job-description, .education-description {
                margin-top: 5px;
              }
              ul {
                margin-top: 5px;
                padding-left: 20px;
              }
              .skills-list {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
              }
              .skill-item {
                background-color: #f5f5f5;
                padding: 3px 8px;
                border-radius: 3px;
                font-size: 14px;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            ${resumeRef.current.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const downloadAsPDF = async () => {
    if (!resumeRef.current) return;

    try {
      setIsDownloading(true);

      // Dynamically import libraries
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      // Create a hidden container at desktop width (8.5" at 96 DPI = 816px)
      const printContainer = document.createElement('div');
      printContainer.style.position = 'fixed';
      printContainer.style.left = '-9999px';
      printContainer.style.top = '0';
      printContainer.style.width = '816px';
      printContainer.style.backgroundColor = '#ffffff';
      printContainer.style.padding = '48px';

      // Clone the resume content into the print container
      const clonedContent = resumeRef.current.cloneNode(true) as HTMLElement;
      printContainer.appendChild(clonedContent);
      document.body.appendChild(printContainer);

      // Capture the fixed-width container
      const canvas = await html2canvas(printContainer, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Remove the temporary container
      document.body.removeChild(printContainer);

      // Convert canvas to PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

      // Download the PDF
      const fileName = `${formData.personalInfo.name || 'Resume'}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Your ATS-Friendly Resume</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={printResume}
            className="flex items-center gap-1"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button
            onClick={downloadAsPDF}
            disabled={isDownloading}
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="ats-tips">ATS Tips</TabsTrigger>
        </TabsList>
        <TabsContent value="preview">
          <Card className="p-8 bg-white">
            <div ref={resumeRef} className="max-w-[800px] mx-auto space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">
                  {formData.personalInfo.name || 'Your Name'}
                </h1>
                <div className="text-sm space-y-1">
                  {formData.personalInfo.email && (
                    <div>{formData.personalInfo.email}</div>
                  )}
                  <div className="flex justify-center gap-4">
                    {formData.personalInfo.phone && (
                      <span>{formData.personalInfo.phone}</span>
                    )}
                    {formData.personalInfo.location && (
                      <span>{formData.personalInfo.location}</span>
                    )}
                    {formData.personalInfo.linkedin && (
                      <span>{formData.personalInfo.linkedin}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary */}
              {formData.summary && (
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold border-b border-gray-300 pb-2">
                    Professional Summary
                  </h2>
                  <p className="leading-relaxed">{formData.summary}</p>
                </div>
              )}

              {/* Work Experience */}
              {formData.workExperience.some(
                (exp) => exp.company || exp.position
              ) && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold border-b border-gray-300 pb-2">
                    Work Experience
                  </h2>
                  <div className="space-y-4">
                    {formData.workExperience.map((exp, index) => (
                      <div key={exp.id} className="space-y-1">
                        {(exp.company || exp.position) && (
                          <div className="flex justify-between items-start">
                            <div>
                              {exp.position && (
                                <div className="font-bold">{exp.position}</div>
                              )}
                              {exp.company && <div>{exp.company}</div>}
                            </div>
                            {(exp.startDate || exp.endDate) && (
                              <div className="text-sm whitespace-nowrap ml-4">
                                {exp.startDate}{' '}
                                {exp.startDate && exp.endDate && '–'}{' '}
                                {exp.endDate}
                              </div>
                            )}
                          </div>
                        )}
                        {exp.description && (
                          <p className="text-sm leading-relaxed">
                            {exp.description}
                          </p>
                        )}
                        {exp.achievements && (
                          <ul className="text-sm list-disc pl-5 space-y-1 leading-relaxed">
                            {formatAchievements(exp.achievements).map(
                              (achievement, i) => (
                                <li key={i}>
                                  {achievement.replace(/^•\s*/, '')}
                                </li>
                              )
                            )}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Education */}
              {formData.education.some(
                (edu) => edu.institution || edu.degree
              ) && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold border-b border-gray-300 pb-2">
                    Education
                  </h2>
                  <div className="space-y-4">
                    {formData.education.map((edu, index) => (
                      <div key={edu.id} className="space-y-1">
                        {(edu.institution || edu.degree || edu.field) && (
                          <div className="flex justify-between items-start">
                            <div>
                              {edu.degree && edu.field ? (
                                <div className="font-bold">
                                  {edu.degree} in {edu.field}
                                </div>
                              ) : (
                                <>
                                  {edu.degree && (
                                    <div className="font-bold">{edu.degree}</div>
                                  )}
                                  {edu.field && (
                                    <div className="font-bold">{edu.field}</div>
                                  )}
                                </>
                              )}
                              {edu.institution && <div>{edu.institution}</div>}
                            </div>
                            {edu.graduationDate && (
                              <div className="text-sm whitespace-nowrap ml-4">
                                {edu.graduationDate}
                              </div>
                            )}
                          </div>
                        )}
                        {edu.description && (
                          <p className="text-sm leading-relaxed">
                            {edu.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {formData.skills && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold border-b border-gray-300 pb-2">
                    Skills
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {formatSkills(formData.skills).map((skill, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 px-3 py-1 rounded-md text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="ats-tips">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-4">ATS Optimization Tips</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Keywords</h4>
                <p>
                  Your resume includes keywords that match the job description.
                  ATS systems scan for these keywords to determine relevance.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Formatting</h4>
                <p>
                  This resume uses a clean, simple format that ATS systems can
                  easily parse. Avoid tables, headers/footers, and complex
                  formatting that might confuse ATS.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">File Format</h4>
                <p>
                  When downloading, save as a PDF or .docx file as these are
                  most compatible with ATS systems.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Quantifiable Achievements</h4>
                <p>
                  Including metrics and numbers in your achievements helps both
                  ATS and human reviewers understand your impact.
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Job Title Alignment</h4>
                <p>
                  When possible, match your job titles to those in the job
                  description (if accurate to your experience).
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
