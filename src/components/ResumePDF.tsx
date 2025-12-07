import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { ResumeFormData } from '@/lib/schemas/resume';

// PDF styles scaled to ~0.75x of preview for proper PDF sizing
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#333333',
  },
  header: {
    textAlign: 'center',
    marginBottom: 18,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#111111',
    marginBottom: 6,
  },
  contactInfo: {
    fontSize: 10,
    color: '#333333',
  },
  email: {
    marginBottom: 3,
  },
  contactRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderBottomStyle: 'solid',
    paddingBottom: 6,
    marginBottom: 9,
    color: '#111111',
  },
  paragraph: {
    fontSize: 10,
  },
  experienceItem: {
    marginBottom: 12,
  },
  experienceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  experienceLeft: {
    flex: 1,
  },
  jobTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 2,
  },
  company: {
    fontSize: 10,
  },
  dateRange: {
    fontSize: 10,
    color: '#333333',
  },
  description: {
    fontSize: 10,
    marginTop: 3,
  },
  achievementsList: {
    marginTop: 3,
    paddingLeft: 15,
  },
  achievementItem: {
    fontSize: 10,
    marginBottom: 3,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  skillItem: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: 10,
  },
});

interface ResumePDFProps {
  formData: ResumeFormData;
}

const formatAchievements = (achievements: string | undefined) => {
  if (!achievements) return [];
  return achievements
    .split(/\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .map((item) => item.replace(/^[-•]\s*/, ''));
};

const formatSkills = (skills: string | undefined) => {
  if (!skills) return [];
  return skills
    .split(/,|\n|•/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export function ResumePDFDocument({ formData }: ResumePDFProps) {
  const hasWorkExperience = formData.workExperience.some(
    (exp) => exp.company || exp.position
  );
  const hasEducation = formData.education.some(
    (edu) => edu.institution || edu.degree
  );

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>
            {formData.personalInfo.name || 'Your Name'}
          </Text>
          <View style={styles.contactInfo}>
            {formData.personalInfo.email && (
              <Text style={styles.email}>{formData.personalInfo.email}</Text>
            )}
            <View style={styles.contactRow}>
              {formData.personalInfo.phone && (
                <Text>{formData.personalInfo.phone}</Text>
              )}
              {formData.personalInfo.location && (
                <Text>{formData.personalInfo.location}</Text>
              )}
              {formData.personalInfo.linkedin && (
                <Text>{formData.personalInfo.linkedin}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Summary */}
        {formData.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.paragraph}>{formData.summary}</Text>
          </View>
        )}

        {/* Work Experience */}
        {hasWorkExperience && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Experience</Text>
            {formData.workExperience.map((exp, index) => {
              if (!exp.company && !exp.position) return null;
              const isLast = index === formData.workExperience.length - 1;
              return (
                <View key={exp.id} style={isLast ? {} : styles.experienceItem}>
                  <View style={styles.experienceHeader}>
                    <View style={styles.experienceLeft}>
                      {exp.position && (
                        <Text style={styles.jobTitle}>{exp.position}</Text>
                      )}
                      {exp.company && (
                        <Text style={styles.company}>{exp.company}</Text>
                      )}
                    </View>
                    {(exp.startDate || exp.endDate) && (
                      <Text style={styles.dateRange}>
                        {exp.startDate}
                        {exp.startDate && exp.endDate && ' – '}
                        {exp.endDate}
                      </Text>
                    )}
                  </View>
                  {exp.description && (
                    <Text style={styles.description}>{exp.description}</Text>
                  )}
                  {exp.achievements && (
                    <View style={styles.achievementsList}>
                      {formatAchievements(exp.achievements).map(
                        (achievement, i) => (
                          <Text key={i} style={styles.achievementItem}>
                            • {achievement}
                          </Text>
                        )
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Education */}
        {hasEducation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {formData.education.map((edu, index) => {
              if (!edu.institution && !edu.degree) return null;
              const isLast = index === formData.education.length - 1;
              return (
                <View key={edu.id} style={isLast ? {} : styles.experienceItem}>
                  <View style={styles.experienceHeader}>
                    <View style={styles.experienceLeft}>
                      {edu.degree && edu.field ? (
                        <Text style={styles.jobTitle}>
                          {edu.degree} in {edu.field}
                        </Text>
                      ) : (
                        <>
                          {edu.degree && (
                            <Text style={styles.jobTitle}>{edu.degree}</Text>
                          )}
                          {edu.field && (
                            <Text style={styles.jobTitle}>{edu.field}</Text>
                          )}
                        </>
                      )}
                      {edu.institution && (
                        <Text style={styles.company}>{edu.institution}</Text>
                      )}
                    </View>
                    {edu.graduationDate && (
                      <Text style={styles.dateRange}>{edu.graduationDate}</Text>
                    )}
                  </View>
                  {edu.description && (
                    <Text style={styles.description}>{edu.description}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Skills */}
        {formData.skills && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsContainer}>
              {formatSkills(formData.skills).map((skill, index) => (
                <Text key={index} style={styles.skillItem}>
                  {skill}
                </Text>
              ))}
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}

export async function generateResumePDF(formData: ResumeFormData): Promise<Blob> {
  const blob = await pdf(<ResumePDFDocument formData={formData} />).toBlob();
  return blob;
}
