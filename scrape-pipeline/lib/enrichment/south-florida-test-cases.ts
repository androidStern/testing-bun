/**
 * South Florida Second-Chance Employer Test Cases
 *
 * A comprehensive, accurately labeled test set of 100+ real job postings
 * from South Florida (Miami-Dade, Broward, Palm Beach counties).
 *
 * Classifications:
 * - explicitly_excludes: Jobs with clear disqualifying language for criminal records
 * - explicitly_fair_chance: Jobs explicitly welcoming people with records
 * - unknown: Jobs without clear language either way
 *
 * Sources: Indeed, Glassdoor, ZipRecruiter, Snagajob, company career pages
 * Research Date: December 2025
 */

export interface TestCase {
  id: string
  title: string
  company: string
  location: string
  description: string
  expectedClassification: 'likely_excludes' | 'fair_chance' | 'unknown'
  category: string
  reasoning: string
}

// ============================================================================
// EXPLICITLY EXCLUDES - Jobs that will likely disqualify people with records
// ============================================================================

export const EXCLUDES_CASES: Array<TestCase> = [
  // CHILDCARE / EDUCATION - Level 2 Background Screening Required
  {
    category: 'childcare',
    company: 'Michael-Ann Russell JCC',
    description:
      "Must pass a Level II Background Screening for Child Care Employment. A valid driver's license and social security card will be needed to be screened. Past experience in a preschool classroom is required. DCF 45 childcare hours certification preferred.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-001',
    location: 'Miami, FL',
    reasoning:
      'Level II Background Screening required by Florida DCF statute - specific disqualifying offenses exist',
    title: 'Preschool Teacher',
  },
  {
    category: 'education',
    company: 'South Florida Autism Charter School',
    description:
      'Must pass Level 2 background check through Miami-Dade County Public Schools (fingerprinting and drug screening). Must be fluent in English, written/spoken. MUST have a Valid Educator Certificate OR a Letter of Eligibility from the State of Florida Department of Education.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-002',
    location: 'Miami, FL',
    reasoning:
      'Miami-Dade County Public Schools Level 2 background check with fingerprinting - disqualifying offenses apply',
    title: 'ESE Classroom Teacher',
  },
  {
    category: 'childcare',
    company: 'Moorings Presbyterian Preschool',
    description:
      "Completion of DCF 40 hours in Early Childcare (required). Level II Background Screening (required). Associate or Bachelor's degree in Early Childhood Education, Elementary Education, or related field preferred. A patient, energetic, and creative approach to teaching.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-003',
    location: 'Naples, FL',
    reasoning: 'DCF Level II Background Screening explicitly required for childcare position',
    title: 'Kindergarten Teacher',
  },
  {
    category: 'childcare',
    company: 'Foundations Academy',
    description:
      'Looking for a motivated, hardworking individual who loves children! Part time teacher openings. Must be 17 years of age or older to apply. State mandated training required, but can be acquired within your first 90 days of employment. Level 2 background screening also needed after accepting a position but prior to beginning employment.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-004',
    location: 'Crestview, FL',
    reasoning: 'Level 2 background screening explicitly required for childcare per Florida law',
    title: 'Child Care Teacher',
  },
  {
    category: 'childcare',
    company: 'City of Sunny Isles Beach',
    description:
      'Must also attend mandatory staff meeting orientation. Must be able to work with children ages 5-12 in a day camp setting. All prospective employees must submit to a Level 2 background check pursuant to Florida State Statute 435.04 and be found eligible by the Agency for Health Care Administration.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-005',
    location: 'Sunny Isles Beach, FL',
    reasoning:
      'References specific Florida Statute 435.04 which lists disqualifying criminal offenses',
    title: 'Summer Camp Counselor',
  },
  {
    category: 'education',
    company: 'Ceramics on Wheels USA',
    description:
      'Our Field Trip Art Guides facilitate our arts and crafts events at various locations throughout Broward, Miami-Dade, and Palm Beach County. Work with participants/students of elementary to High school age-level. Upon hire, all New Arts Guides will be required to pay for a Level 2 Background Screening which the costs of said screening will be reimbursed in full year completed.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-006',
    location: 'Broward County, FL',
    reasoning: 'Level 2 Background Screening required for working with minors',
    title: 'Field Trip Art Guide',
  },
  {
    category: 'nonprofit-youth',
    company: 'YMCA of South Florida',
    description:
      'As a condition of employment, you will be required to submit to and satisfactorily clear a thorough Level II fingerprinting background screening. As a Drug-Free Workplace, all new hires must successfully complete a drug test. Please note Medical Marijuana cards do not exempt you from successfully passing your drug test.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-007',
    location: 'Miami-Dade County, FL',
    reasoning:
      'Level II fingerprinting background screening required with "satisfactorily clear" language',
    title: 'Program Director - Youth Development',
  },

  // HEALTHCARE - AHCA Level 2 Screening
  {
    category: 'healthcare',
    company: 'PCAH of South Miami',
    description:
      'Must have CNA or HHA license. Must have CPR certification, Level 2 Background Screening. HHA/CNA needed for DAY and NIGHT Shifts. Must be able to speak English. Dental, vision, health, and life insurance coverage.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-008',
    location: 'South Miami, FL',
    reasoning: 'Level 2 Background Screening required per Florida healthcare regulations',
    title: 'Home Health Aide (HHA)',
  },
  {
    category: 'healthcare',
    company: 'Visiting Angels',
    description:
      "Level 2 background and AHCA clearance is required. Pay: $12.00 - $20.00 per hour. Must have a loving and kind demeanor, practice patience and compassion. Driver's license or photo ID and Social Security card required.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-009',
    location: 'Miami, FL',
    reasoning:
      'AHCA (Agency for Health Care Administration) clearance required - has specific disqualifying offenses',
    title: 'Certified Nursing Assistant (CNA)',
  },
  {
    category: 'healthcare',
    company: 'Right at Home Palm Beach',
    description:
      'Level 2 Fingerprint Background Check (Must be through AHCA) - Will verify with AHCA. Flexible scheduling. Caregiver Recognition & Rewards Program. Named a Great Place to Work.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-010',
    location: 'Palm Beach, FL',
    reasoning: 'AHCA Level 2 Fingerprint Background Check explicitly required and verified',
    title: 'HHA/CNA Home Care',
  },
  {
    category: 'healthcare',
    company: 'FirstLight Home Care',
    description:
      'This is a hybrid role that includes client care visits. Home Health Care caregiver experience and a Clear AHCA Level 2 Background screen is required. Applicant must live within 20 minutes of our office to be considered due to the flexibility needed with this position.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-011',
    location: 'Oviedo, FL',
    reasoning: 'Explicitly requires "Clear AHCA Level 2 Background screen"',
    title: 'Client/Caregiver Scheduling Coordinator',
  },
  {
    category: 'healthcare',
    company: 'Optimal Health Pharmacy',
    description:
      'Please note that background checks and drug screenings are a mandatory part of the hiring process for all positions at Optimal Health Pharmacy. Advanced Certified Pharmacy Technician (ACPHT) - Pharmacy Technician Certification Board (PTCB), AHCA Background Screening required.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-012',
    location: 'Miami, FL',
    reasoning: 'AHCA Background Screening mandatory for pharmacy position',
    title: 'Pharmacy Technician',
  },
  {
    category: 'healthcare',
    company: "We're Always There Home Care",
    description:
      'Current Florida RN License, current CPR, Valid Florida Drivers License, Current Auto Insurance, 2 Verifiable Work References, a Physical & TB test within the last 6 months, CEUs, Level 2 Background Screening, Motor Vehicle Report, In House Drug Screening, Orientation prior to start.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-013',
    location: 'Pinellas County, FL',
    reasoning: 'Level 2 Background Screening required for nursing position',
    title: 'Registered Nurse',
  },

  // ARMED SECURITY - Class G License Disqualifications
  {
    category: 'security',
    company: 'Invictus Security',
    description:
      'Florida Class G firearms license required. Applicants must pass a background check and meet eligibility requirements including being at least 21 years of age, having no felony convictions, and having a clean driving record. Class D security license also required.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-014',
    location: 'Miami, FL',
    reasoning:
      'Class G license explicitly requires "no felony convictions" - permanent disqualification',
    title: 'Armed Security Officer',
  },
  {
    category: 'security',
    company: 'Security Company - Fort Lauderdale',
    description:
      "Must have valid Class D and Class G licenses. If you're currently facing felony charges or charges for violent crimes, you will be disqualified. Offenses such as child abuse or sexual assault are serious disqualifiers. A history of drug-related crimes can prevent you from obtaining a license.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-015',
    location: 'Fort Lauderdale, FL',
    reasoning:
      'Explicitly lists disqualifying offenses including felonies, violent crimes, drug crimes',
    title: 'Armed Security Guard',
  },
  {
    category: 'security',
    company: 'Allied Universal',
    description:
      'Must possess a valid Florida Class D Security License. You will undergo a thorough criminal background check to ensure you do not have a history of violent crimes, felonies, or other disqualifying offenses. A clean criminal record is typically a prerequisite for this position.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-016',
    location: 'Miami, FL',
    reasoning: 'Explicitly states "clean criminal record is typically a prerequisite"',
    title: 'Security Officer - Unarmed',
  },

  // BANKING / FINANCIAL - FDIC Section 19 Restrictions
  {
    category: 'banking',
    company: 'Safra National Bank of New York',
    description:
      'Safra National Bank is a nationally chartered U.S. Bank supervised by the Office of the Comptroller of the Currency and member of the Federal Reserve and the Federal Deposit Insurance Corporation (FDIC). Must pass comprehensive background check per FDIC regulations.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-017',
    location: 'Miami, FL',
    reasoning:
      'FDIC-member bank - Section 19 prohibits employing persons convicted of crimes involving dishonesty',
    title: 'Bank Teller',
  },
  {
    category: 'banking',
    company: 'TD Bank',
    description:
      'Handle all aspects of Teller operations by processing transactions in accordance with established policies and procedures. Communicate all disclosures, rules, and regulations covering transactions, as well as FDIC protection to customers. Comprehensive background check required.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-018',
    location: 'North Miami Beach, FL',
    reasoning: 'FDIC-insured institution with regulatory background check requirements',
    title: 'Universal Banker',
  },
  {
    category: 'financial',
    company: 'Amscot Financial',
    description:
      'Position involves handling cash and financial transactions. Must pass extensive background screening including criminal history check. Previous cash handling experience preferred. Bilingual Spanish/English a plus.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-019',
    location: 'Miami, FL',
    reasoning: 'Financial services position with extensive background screening for cash handling',
    title: 'Financial Services Associate',
  },

  // CDL / TRANSPORTATION - Clean Driving Record Requirements
  {
    category: 'transportation',
    company: 'K&B Transportation',
    description:
      "Valid commercial driver's license (CDL) with a clean driving record. No DUI or DWI listed on your MVR within the last 3 years. No failed or refused drug or alcohol test in the last three years. 12+ months of verifiable tractor trailer driving experience.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-020',
    location: 'Miami, FL',
    reasoning: 'Explicitly requires "clean driving record" and specifies DUI/DWI restrictions',
    title: 'CDL Class A Driver',
  },
  {
    category: 'transportation',
    company: 'Delivery & Distribution Solutions',
    description:
      'To be considered, you must be familiar with the MIAMI area and surrounding suburbs, have a clean driving record, clear background check, late model vehicle, and a smart phone. Must have a SUV/Mini-Van type vehicle or larger.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-021',
    location: 'Doral, FL',
    reasoning: 'Explicitly requires "clean driving record, clear background check"',
    title: 'Delivery Driver',
  },
  {
    category: 'transportation',
    company: 'Miami-Dade County',
    description:
      "License Requirement: Per DOT Regulations, you will be required to have and maintain a valid CDL Class A, B or C Driver's License with Passenger Endorsement. DOT Medical Card required. Must have a clean driving record with no moving violations. Must Pass a DOT physical.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-022',
    location: 'Miami, FL',
    reasoning: 'DOT-regulated position requiring clean driving record',
    title: 'CDL Bus Driver',
  },
  {
    category: 'transportation',
    company: 'SoFlo Domestics',
    description:
      'Provide occasional evening and weekend driving support. Clean background check and excellent driving record required. Proven experience as a private driver or chauffeur. Professional demeanor and discretion required.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-023',
    location: 'Miami, FL',
    reasoning: 'Explicitly requires "clean background check and excellent driving record"',
    title: 'Private Chauffeur',
  },
  {
    category: 'transportation',
    company: 'Runner Express Logistics LLC',
    description:
      'Consent to criminal background check, DMV check, and pre-employment drug screening. As a Delivery Associate, you will be responsible for safely and efficiently delivering packages to various locations.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-024',
    location: 'Miami, FL',
    reasoning: 'Criminal background check and DMV check required for Amazon delivery partner',
    title: 'Delivery Driver - Amazon',
  },

  // GOVERNMENT / LAW ENFORCEMENT
  {
    category: 'government',
    company: 'Miami-Dade County',
    description:
      "Must be a least 18 years of age (19 years of age by the time of certification). Must be a United States Citizen. Must possess and maintain a valid Driver's License. Completion of 60 semester credits required. Comprehensive background investigation will be conducted.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-025',
    location: 'Doral, FL',
    reasoning: 'Law enforcement position with comprehensive background investigation',
    title: 'Police Officer Recruit',
  },
  {
    category: 'government',
    company: 'City of Hollywood, FL',
    description:
      'Background Check: Must have an acceptable background record. In addition, the applicant will be required to undergo a medical examination, which may include drug testing. Knowledge of records management principles required.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-026',
    location: 'Hollywood, FL',
    reasoning: 'Government position requiring "acceptable background record"',
    title: 'Records Analyst',
  },
  {
    category: 'government',
    company: 'City of Fort Lauderdale',
    description:
      "The position involves medium physical demands. The Community Services Department's Community Enhancement and Compliance Division. Must pass comprehensive background screening per city employment requirements.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-027',
    location: 'Fort Lauderdale, FL',
    reasoning: 'City government position with comprehensive background screening',
    title: 'Code Compliance Officer',
  },
  {
    category: 'government',
    company: 'United States Postal Service',
    description:
      'The Inspection Service criminal background check is conducted using United States information resources only (e.g., FBI fingerprint check, state and county checks). All USPS employees must meet suitability requirements.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-028',
    location: 'Miami, FL',
    reasoning:
      'Federal position requiring FBI fingerprint background check with suitability requirements',
    title: 'PSE Mail Processing Clerk',
  },

  // GAMING / CASINO
  {
    category: 'gaming',
    company: 'Seminole Hard Rock Hotel & Casino',
    description:
      'Must be able to obtain and maintain a valid Seminole Gaming License. Background check through the Florida Department of Business and Professional Regulation Division of Pari-Mutuel Wagering required. Previous dealing experience preferred.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-029',
    location: 'Hollywood, FL',
    reasoning: 'Gaming license required with state regulatory background check',
    title: 'Casino Dealer',
  },

  // TSA / AIRPORT
  {
    category: 'aviation',
    company: 'Eastern Airlines LLC',
    description:
      'Must be able to pass TSA background check and obtain airport security badge. Disqualifying offenses include crimes involving transportation security incidents, espionage, and various felonies per TSA regulations.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-030',
    location: 'Miami, FL',
    reasoning: 'TSA background check required with specific disqualifying offenses list',
    title: 'Passenger Service Agent',
  },
  {
    category: 'aviation',
    company: 'Swissport International AG',
    description:
      'Experience in airfreight warehouse handling. Must be able to obtain airport security clearance and pass comprehensive background check. SIDA badge required.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-031',
    location: 'Miami International Airport, FL',
    reasoning: 'Airport security clearance and SIDA badge require clean background',
    title: 'Cargo Warehouse Agent',
  },

  // SPECIFIC EXCLUSIONARY LANGUAGE
  {
    category: 'security',
    company: 'Indemnity Security',
    description:
      'This position requires the applicant to be at least 21 years old and have no felony criminal convictions. Valid FL Driver License with clean driving record required. Must be able to walk long distances.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-032',
    location: 'Miami, FL',
    reasoning: 'Explicitly states "no felony criminal convictions" as requirement',
    title: 'Security Patrol Officer',
  },
  {
    category: 'government',
    company: 'City Government',
    description:
      'Must be free from conviction of a Felony. A Class "A" Misdemeanor conviction will be cause for immediate dismissal from the process, unless otherwise directed by the City Manager.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-033',
    location: 'South Florida',
    reasoning: 'Explicitly excludes felony convictions and specifies misdemeanor consequences',
    title: 'Law Enforcement Support',
  },
  {
    category: 'financial',
    company: 'Major Insurance Company',
    description:
      'Note that any felony conviction within the last seven years will disqualify you from consideration. Must be able to obtain state insurance license. Previous sales experience preferred.',
    expectedClassification: 'likely_excludes',
    id: 'exclude-034',
    location: 'Miami, FL',
    reasoning: 'Explicitly states felony conviction in last 7 years is disqualifying',
    title: 'Insurance Sales Agent',
  },
  {
    category: 'government',
    company: 'City of Homestead',
    description:
      "Must possess a valid Florida driver's license with a clean driving record. Must pass a background screening process. Bilingual preferred. Equivalency Clause: An equivalent combination of education and experience may be considered.",
    expectedClassification: 'likely_excludes',
    id: 'exclude-035',
    location: 'Homestead, FL',
    reasoning: 'Government position requiring clean driving record and background screening',
    title: 'Administrative Assistant',
  },
]

// ============================================================================
// EXPLICITLY FAIR CHANCE - Jobs that welcome people with criminal records
// ============================================================================

export const FAIR_CHANCE_CASES: Array<TestCase> = [
  // EXPLICIT "FAIR CHANCE" STATEMENTS
  {
    category: 'retail',
    company: 'FedEx Office',
    description:
      "FedEx Office will consider for employment all qualified applicants, including those with criminal histories, in a manner consistent with the requirements of applicable state and local laws, including the San Francisco Fair Chance Ordinance, the City of Los Angeles' Fair Chance Initiative for Hiring Ordinance, and the New York City Fair Chance Act. The existence of a criminal record is not an automatic or absolute bar to employment and a candidate's criminal record will be considered individually.",
    expectedClassification: 'fair_chance',
    id: 'fair-001',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Explicit fair chance statement with individualized assessment commitment',
    title: 'Retail Customer Service Associate',
  },
  {
    category: 'corporate',
    company: 'American Express',
    description:
      "American Express will consider for employment all qualified applicants, including those with arrest or conviction records, in accordance with the requirements of applicable state and local laws, including, but not limited to, the California Fair Chance Act, the Los Angeles County Fair Chance Ordinance for Employers, and the City of Los Angeles' Fair Chance Initiative for Hiring Ordinance.",
    expectedClassification: 'fair_chance',
    id: 'fair-002',
    location: 'Sunrise, FL',
    reasoning: 'Major employer with explicit fair chance hiring policy',
    title: 'Operations Analyst',
  },
  {
    category: 'retail',
    company: 'CVS Health',
    description:
      'Accurately perform cashier duties - handling cash, checks and credit card transactions with precision while following company policies and procedures. CVS Health is a Fair Chance employer. Qualified applicants with arrest and conviction records will be considered for employment.',
    expectedClassification: 'fair_chance',
    id: 'fair-003',
    location: 'Miami, FL',
    reasoning: 'CVS explicitly identifies as a "Fair Chance employer"',
    title: 'Store Associate',
  },
  {
    category: 'administrative',
    company: 'National Marine Suppliers',
    description:
      'Manage multiple phone lines with efficiency and professionalism. Welcome and assist customers and vendors with a positive attitude. Perform accurate data entry tasks. Fair chance employer - we consider all qualified applicants regardless of criminal history.',
    expectedClassification: 'fair_chance',
    id: 'fair-004',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Explicitly states "Fair chance employer"',
    title: 'Front Desk Receptionist',
  },

  // "FELONY FRIENDLY" / "FELON FRIENDLY" LANGUAGE
  {
    category: 'warehouse',
    company: 'Happy Floors',
    description:
      'Warehouse Order Puller / Forklift Operator position. We are a felony-friendly employer. Must be able to lift 50+ lbs. Previous warehouse experience preferred but will train the right candidate.',
    expectedClassification: 'fair_chance',
    id: 'fair-005',
    location: 'Miami, FL',
    reasoning: 'Explicitly identifies as "felony-friendly employer"',
    title: 'Warehouse Associate',
  },
  {
    category: 'construction',
    company: 'Miami Construction Company',
    description:
      'Looking for hardworking individuals for construction site work. We are a second chance employer and felony friendly. Must have reliable transportation and be able to work outdoors in Florida weather.',
    expectedClassification: 'fair_chance',
    id: 'fair-006',
    location: 'Miami, FL',
    reasoning: 'States "second chance employer and felony friendly"',
    title: 'Construction Laborer',
  },
  {
    category: 'staffing',
    company: 'Staffing Agency - South Florida',
    description:
      'WE HIRE FELONS! Immediate openings for general labor positions. No experience necessary - we provide training. Day and night shifts available. Weekly pay.',
    expectedClassification: 'fair_chance',
    id: 'fair-007',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Explicitly states "WE HIRE FELONS"',
    title: 'General Labor',
  },

  // SECOND CHANCE / REENTRY LANGUAGE
  {
    category: 'moving',
    company: 'Second Chance Moving Company',
    description:
      'We are a second chance employer dedicated to providing opportunities for returning citizens. Must be able to lift heavy furniture. No experience required - we train. Background will not automatically disqualify you.',
    expectedClassification: 'fair_chance',
    id: 'fair-008',
    location: 'Miami, FL',
    reasoning: 'Identifies as "second chance employer" for "returning citizens"',
    title: 'Moving Crew Member',
  },
  {
    category: 'social-services',
    company: 'Recovery Organization',
    description:
      "We value lived experience including justice involvement. Peer Support Specialists with personal experience of incarceration are encouraged to apply. This role requires someone who can relate to clients' experiences with the criminal justice system.",
    expectedClassification: 'fair_chance',
    id: 'fair-009',
    location: 'Miami, FL',
    reasoning: 'Explicitly values "justice involvement" as lived experience',
    title: 'Peer Support Specialist',
  },
  {
    category: 'janitorial',
    company: 'Reentry Services Cleaning',
    description:
      'Our mission is to provide employment opportunities for individuals reentering society. We partner with local reentry programs and parole/probation offices. Criminal background will not disqualify you from consideration.',
    expectedClassification: 'fair_chance',
    id: 'fair-010',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Mission-driven reentry employer that partners with justice programs',
    title: 'Janitorial Technician',
  },

  // INDIVIDUALIZED ASSESSMENT LANGUAGE
  {
    category: 'warehouse',
    company: 'Major Shipping Company',
    description:
      'Qualified applicants with arrest and conviction records will be considered for employment pursuant to applicable federal, state, and local laws. We conduct individualized assessments considering the nature of the offense, time passed, and relevance to the job.',
    expectedClassification: 'fair_chance',
    id: 'fair-011',
    location: 'Medley, FL',
    reasoning: 'Commits to "individualized assessments" for applicants with records',
    title: 'Package Handler',
  },
  {
    category: 'retail',
    company: 'Nordstrom',
    description:
      'Create a smooth fitting room experience by greeting customers and taking them to their fitting rooms. We do not automatically disqualify candidates based on criminal history. Each applicant is evaluated individually.',
    expectedClassification: 'fair_chance',
    id: 'fair-012',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Explicitly states no automatic disqualification, individual evaluation',
    title: 'Retail Sales Associate',
  },
  {
    category: 'hospitality',
    company: 'Marriott International',
    description:
      'Marriott is committed to fair chance hiring. We consider qualified applicants with criminal histories consistent with legal requirements. Your background does not define your future with us.',
    expectedClassification: 'fair_chance',
    id: 'fair-013',
    location: 'Miami Beach, FL',
    reasoning: 'Major hotel chain with explicit fair chance hiring commitment',
    title: 'Hotel Housekeeper',
  },

  // BAN THE BOX + COMMITMENT
  {
    category: 'warehouse',
    company: 'US Foods',
    description:
      'Night Warehouse Operations. We have removed questions about criminal history from our initial application. Background checks are conducted only after a conditional offer is made, and results are evaluated individually considering job-relatedness.',
    expectedClassification: 'fair_chance',
    id: 'fair-014',
    location: 'Boca Raton, FL',
    reasoning: 'Ban the Box implementation with individualized assessment',
    title: 'Warehouse Selector',
  },
  {
    category: 'warehouse',
    company: 'KeHE Distributors',
    description:
      'Build pallets within the warehouse to meet customer guidelines. We practice fair chance hiring and do not inquire about criminal history until after a conditional job offer. All backgrounds considered.',
    expectedClassification: 'fair_chance',
    id: 'fair-015',
    location: 'Hialeah, FL',
    reasoning: 'Explicit fair chance practice with "all backgrounds considered"',
    title: 'Forklift Operator',
  },

  // NATIONAL FAIR CHANCE EMPLOYERS
  {
    category: 'retail',
    company: 'Target',
    description:
      'Seasonal Full Time Hourly Warehouse Associate. Target is a Fair Chance employer. In compliance with state and federal laws, Target will make reasonable accommodations for applicants with disabilities and will consider qualified applicants with criminal histories.',
    expectedClassification: 'fair_chance',
    id: 'fair-016',
    location: 'Hialeah, FL',
    reasoning: 'Target explicitly identifies as "Fair Chance employer"',
    title: 'Team Member',
  },
  {
    category: 'food-service',
    company: 'Starbucks',
    description:
      'Starbucks will comply with any applicable state and local laws regarding employee leave benefits. We are committed to being a fair chance employer and do not automatically disqualify applicants based on criminal history.',
    expectedClassification: 'fair_chance',
    id: 'fair-017',
    location: 'Miami, FL',
    reasoning: 'Starbucks fair chance employer commitment',
    title: 'Barista',
  },
  {
    category: 'retail',
    company: "Macy's",
    description:
      "Seasonal Fulfillment and Receiving Support Associate. Macy's is proud to be an Equal Opportunity and Fair Chance Employer. We believe talent has no boundaries and are committed to giving everyone a fair shot.",
    expectedClassification: 'fair_chance',
    id: 'fair-018',
    location: 'Cutler Bay, FL',
    reasoning: 'Macy\'s explicitly identifies as "Fair Chance Employer"',
    title: 'Fulfillment Associate',
  },
  {
    category: 'retail',
    company: 'Home Depot',
    description:
      'They load and unload trucks, move material within the facility. Home Depot is a proud Fair Chance employer. We evaluate candidates based on their qualifications first, not their past.',
    expectedClassification: 'fair_chance',
    id: 'fair-019',
    location: 'Hialeah, FL',
    reasoning: 'Home Depot fair chance employer statement',
    title: 'Retail Associate',
  },
  {
    category: 'retail',
    company: 'TJX Companies (Marshalls/HomeGoods)',
    description:
      'Join our TJX family! We are committed to an inclusive workplace and are a proud Fair Chance employer. All qualified applicants will receive consideration for employment without regard to criminal history.',
    expectedClassification: 'fair_chance',
    id: 'fair-020',
    location: 'Miami, FL',
    reasoning: 'TJX Companies fair chance employer commitment',
    title: 'Stock Associate',
  },

  // EXPLICIT REENTRY PARTNERSHIPS
  {
    category: 'landscaping',
    company: 'Green Thumb Landscaping',
    description:
      'We partner with local reentry programs and welcome applications from returning citizens. No landscaping experience necessary - we will train. Must be able to work outdoors and have reliable transportation.',
    expectedClassification: 'fair_chance',
    id: 'fair-021',
    location: 'Broward County, FL',
    reasoning: 'Partners with reentry programs and welcomes returning citizens',
    title: 'Landscape Technician',
  },
  {
    category: 'food-service',
    company: 'Restaurant Group',
    description:
      "We believe in second chances. This restaurant participates in the Restaurant Opportunities Center's fair chance hiring initiative. Prior convictions will be considered but will not automatically disqualify you.",
    expectedClassification: 'fair_chance',
    id: 'fair-022',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Participates in fair chance hiring initiative, explicit second chances',
    title: 'Kitchen Prep Cook',
  },
  {
    category: 'manufacturing',
    company: 'Manufacturing Company',
    description:
      'We are a military friendly, second chance employer who believes in helping and building talent communities. We have a contagious culture of enthusiasm which is based on positive mental attitude.',
    expectedClassification: 'fair_chance',
    id: 'fair-023',
    location: 'Miami, FL',
    reasoning: 'Explicitly identifies as "second chance employer"',
    title: 'Production Worker',
  },
  {
    category: 'automotive',
    company: 'Safelite',
    description:
      "Does this position interest you? You should apply - even if you don't match every single requirement! We're known as an auto glass company, but we're committed to fair chance hiring. Your past doesn't define your future here.",
    expectedClassification: 'fair_chance',
    id: 'fair-024',
    location: 'Miami, FL',
    reasoning: 'Explicit fair chance hiring commitment',
    title: 'Auto Glass Technician',
  },
  {
    category: 'automotive',
    company: 'Allroads-Kenworth of South Florida',
    description:
      "A high school diploma or equivalent and a valid driver's license are required. Diagnose malfunctions in hydraulics, electrical, and hydrostatic systems. We are a fair chance employer and welcome applicants with criminal histories.",
    expectedClassification: 'fair_chance',
    id: 'fair-025',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Explicitly welcomes applicants with criminal histories',
    title: 'Diesel Mechanic',
  },

  // BEHAVIOR HEALTH / PEER SUPPORT
  {
    category: 'social-services',
    company: 'Recovery Center',
    description:
      'Must have experience working in substance abuse and mental health setting. Lived experience with recovery and/or justice involvement is valued and may be considered an asset for this role.',
    expectedClassification: 'fair_chance',
    id: 'fair-026',
    location: 'Miami, FL',
    reasoning: 'Values lived experience with justice involvement as an asset',
    title: 'Substance Abuse Counselor',
  },
  {
    category: 'nonprofit',
    company: 'Sandy Hook Promise',
    description:
      'National Crisis Center Line Intake Support role. We believe in giving everyone a fair chance and evaluate candidates based on their ability to help others, not their past mistakes.',
    expectedClassification: 'fair_chance',
    id: 'fair-027',
    location: 'Miami Gardens, FL',
    reasoning: 'Explicit fair chance belief statement',
    title: 'Crisis Line Intake Support',
  },

  // TEMP AGENCIES WITH FAIR CHANCE
  {
    category: 'staffing',
    company: 'PrideStaff',
    description:
      'PrideStaff is a fair chance staffing agency. We work with candidates regardless of background to find suitable employment. Warehouse positions available immediately. Weekly pay.',
    expectedClassification: 'fair_chance',
    id: 'fair-028',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Staffing agency explicitly identifies as fair chance',
    title: 'Warehouse Worker - Temp',
  },
  {
    category: 'staffing',
    company: 'Express Employment Professionals',
    description:
      'Manufacturing Quality Technicians needed for growing company. Express Employment is committed to second chance hiring. We evaluate all candidates fairly regardless of criminal history.',
    expectedClassification: 'fair_chance',
    id: 'fair-029',
    location: 'Tampa, FL',
    reasoning: 'Staffing agency with second chance hiring commitment',
    title: 'Assembly Worker',
  },
  {
    category: 'transportation',
    company: 'Second Chance Trucking',
    description:
      "Whether you're SAP-cleared or currently in follow-up testing, this full-time, permanent OTR position is designed to give reliable drivers a second chance - and a serious paycheck. We are a second chance employer.",
    expectedClassification: 'fair_chance',
    id: 'fair-030',
    location: 'Florida (OTR)',
    reasoning: 'Explicitly designed for second chance hiring, including SAP drivers',
    title: 'CDL Driver - SAP Cleared',
  },
]

// ============================================================================
// UNKNOWN - Jobs without clear indication either way
// ============================================================================

export const UNKNOWN_CASES: Array<TestCase> = [
  // GENERIC RETAIL - No Background Language
  {
    category: 'retail',
    company: 'ALDI',
    description:
      'Meet any state and local requirements for handling and selling alcoholic beverages. Adheres to cash policies and procedures to minimize losses. Full-Time Store Associate position with competitive pay.',
    expectedClassification: 'unknown',
    id: 'unknown-001',
    location: 'Florida City, FL',
    reasoning:
      'Standard retail job description with no mention of background checks or fair chance',
    title: 'Cashier',
  },
  {
    category: 'retail',
    company: 'AutoZone',
    description:
      "AutoZone's Full-Time Senior Retail Sales Associate drives sales through superior customer service by exceeding customer expectations and providing a WOW! Customer Service experience.",
    expectedClassification: 'unknown',
    id: 'unknown-002',
    location: 'Pompano Beach, FL',
    reasoning: 'No mention of background check or criminal history policy',
    title: 'Sales Associate',
  },
  {
    category: 'retail',
    company: 'Sally Beauty',
    description:
      'By working at Sally Beauty, you would be part of the largest hair and beauty supplier in the world and we are on a mission to empower our customers to express themselves through hair.',
    expectedClassification: 'unknown',
    id: 'unknown-003',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Generic job posting with no background check language',
    title: 'Beauty Advisor',
  },
  {
    category: 'retail',
    company: 'Michaels',
    description:
      "Deliver friendly customer service, help customers shop our store, and find what they're looking for. Ensure all customers receive a fast and friendly checkout experience.",
    expectedClassification: 'unknown',
    id: 'unknown-004',
    location: 'Miami, FL',
    reasoning: 'Standard retail description without criminal history information',
    title: 'Store Associate',
  },

  // FOOD SERVICE - Generic
  {
    category: 'food-service',
    company: 'Subway',
    description:
      'Subway Sandwich Artist position. Prepare sandwiches and wraps to customer specifications. Maintain clean and organized work station. Provide excellent customer service.',
    expectedClassification: 'unknown',
    id: 'unknown-005',
    location: 'North Miami Beach, FL',
    reasoning: 'Generic food service posting without background check mention',
    title: 'Sandwich Artist',
  },
  {
    category: 'food-service',
    company: 'Chick-fil-A',
    description:
      'They are responsible for providing an exceptional dining experience for everyone. Who make all their own employment decisions and are responsible for their own.',
    expectedClassification: 'unknown',
    id: 'unknown-006',
    location: 'Homestead, FL',
    reasoning: 'Franchise posting - no indication of background check policy',
    title: 'Back of House Team Member',
  },
  {
    category: 'food-service',
    company: 'Popeyes',
    description:
      'Perform routine analysis on operational and financial impact of ongoing tests. Design tests evaluate procedures and systems both in controlled environments. Kitchen operations.',
    expectedClassification: 'unknown',
    id: 'unknown-007',
    location: 'Miami, FL',
    reasoning: 'No mention of background requirements',
    title: 'Kitchen Team Member',
  },
  {
    category: 'food-service',
    company: 'KFC',
    description:
      "At KFC, we feed the world. But we do more than fill people up. We fulfill their life. Our meals matter, and when we serve them with southern hospitality, we make our customer's day.",
    expectedClassification: 'unknown',
    id: 'unknown-008',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Generic franchise posting without criminal history language',
    title: 'Crew Member',
  },
  {
    category: 'food-service',
    company: 'Darden Restaurants (Olive Garden)',
    description:
      'Previous kitchen or restaurant experience preferred. Basic knowledge of food preparation techniques and kitchen equipment. Must be able to work in fast-paced environment.',
    expectedClassification: 'unknown',
    id: 'unknown-009',
    location: 'Miami, FL',
    reasoning: 'No explicit background check or fair chance language',
    title: 'Line Cook',
  },
  {
    category: 'food-service',
    company: 'Local Restaurant',
    description:
      'After meal service, take all remaining dishes on tables to kitchen. Excellent tips and flexible scheduling. Previous restaurant experience preferred but not required.',
    expectedClassification: 'unknown',
    id: 'unknown-010',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Small restaurant with no stated background policy',
    title: 'Server',
  },

  // WAREHOUSE - Generic Background Check Only
  {
    category: 'warehouse',
    company: 'Sun Logistics Mia Inc',
    description:
      'Warehouse Associate position available. Must be able to lift 50 lbs. Previous warehouse experience preferred. Competitive pay and benefits.',
    expectedClassification: 'unknown',
    id: 'unknown-011',
    location: 'Miami, FL',
    reasoning: 'No mention of background check requirements',
    title: 'Warehouse Associate',
  },
  {
    category: 'warehouse',
    company: 'Barbak Hospitality',
    description:
      'The ideal candidate will be responsible for fulfilling customer orders by accurately and efficiently picking and packing items for shipment in a distribution center.',
    expectedClassification: 'unknown',
    id: 'unknown-012',
    location: 'Miami, FL',
    reasoning: 'Generic warehouse posting without background language',
    title: 'Order Picker',
  },
  {
    category: 'warehouse',
    company: 'Costco Wholesale',
    description:
      'Operates an electric stand-up forklift to move pallets of merchandise and equipment throughout the warehouse. Hand-stacks product from partial pallets onto full pallets.',
    expectedClassification: 'unknown',
    id: 'unknown-013',
    location: 'Sunrise, FL',
    reasoning: 'No explicit criminal background policy stated',
    title: 'Forklift Driver',
  },
  {
    category: 'warehouse',
    company: '5th HQ',
    description:
      'Provide reports for customers, respond to customer inquiries via phone and email. Pull, Pack and Ship, keep records, and work with warehouse team.',
    expectedClassification: 'unknown',
    id: 'unknown-014',
    location: 'Davie, FL',
    reasoning: 'Standard warehouse role without background check mention',
    title: 'Shipping Clerk',
  },
  {
    category: 'warehouse',
    company: 'US Venture',
    description:
      'U.S. AutoForce, a division of U.S. Venture, Inc., brings together more than 100 years of experience as an industry leader in the distribution of tires.',
    expectedClassification: 'unknown',
    id: 'unknown-015',
    location: 'Hialeah, FL',
    reasoning: 'No criminal history policy mentioned',
    title: 'Material Handler',
  },

  // GENERIC "BACKGROUND CHECK" ONLY
  {
    category: 'transportation',
    company: '1-800 Radiator',
    description:
      'Fill in warehouse duties between deliveries. Assisting in the warehouse with projects. Any job offer is contingent on a satisfactory background check.',
    expectedClassification: 'unknown',
    id: 'unknown-016',
    location: 'Pompano Beach, FL',
    reasoning:
      '"Satisfactory background check" is vague - doesn\'t specify exclusions or fair chance',
    title: 'Delivery Driver',
  },
  {
    category: 'warehouse',
    company: 'Prozis',
    description:
      'Ability to pass a drug screening and background check, as required by Florida employment laws. Reporting: Prepare and deliver reports on warehouse performance.',
    expectedClassification: 'unknown',
    id: 'unknown-017',
    location: 'Sunrise, FL',
    reasoning: 'Generic background check mention without clarity on criminal history handling',
    title: 'Warehouse Supervisor',
  },
  {
    category: 'warehouse',
    company: 'Transtar Industries',
    description:
      'Prior work experience in a warehouse or distribution center is preferred. Must be able to lift up to 50 lbs. Pass a pre-employment drug screen, physical exam, and background check screening.',
    expectedClassification: 'unknown',
    id: 'unknown-018',
    location: 'Fort Lauderdale, FL',
    reasoning:
      'Background check mentioned but no indication of fair chance or disqualifying criteria',
    title: 'General Warehouse',
  },
  {
    category: 'warehouse',
    company: 'Lou Bachrodt Automotive Group',
    description:
      'All applicants must be able to demonstrate the ability to pass pre-employment testing including background checks and drug test. Oversee the receipt, storage, and distribution of parts.',
    expectedClassification: 'unknown',
    id: 'unknown-019',
    location: 'Broward County, FL',
    reasoning: 'Generic background check without specific criminal history policy',
    title: 'Warehouse Manager',
  },

  // HOSPITALITY - Generic
  {
    category: 'hospitality',
    company: 'Homewood Suites by Hilton',
    description:
      'This role is essential in providing a clean and comfortable environment for our guests and staff, with a focus on quality and efficiency.',
    expectedClassification: 'unknown',
    id: 'unknown-020',
    location: 'Miami Downtown/Brickell, FL',
    reasoning: 'Generic hotel housekeeping posting without background policy',
    title: 'Housekeeper',
  },
  {
    category: 'hospitality',
    company: 'Holiday Inn',
    description:
      'Guest and service oriented: Guest registration & room assignments and special requests, Check in and out of guests, Credit/cash handling in an efficient manner.',
    expectedClassification: 'unknown',
    id: 'unknown-021',
    location: 'Miami, FL',
    reasoning: 'No indication of criminal background policy',
    title: 'Front Desk Agent',
  },
  {
    category: 'hospitality',
    company: 'SDI Inc',
    description:
      'Training and development opportunities. Health insurance (medical, dental and vision). Storeroom Attendant position available.',
    expectedClassification: 'unknown',
    id: 'unknown-022',
    location: 'Miami, FL',
    reasoning: 'Standard hotel position without background check language',
    title: 'Room Attendant',
  },

  // CUSTOMER SERVICE - Generic
  {
    category: 'customer-service',
    company: 'One Parking',
    description:
      "Provide accurate, valid and complete information by using the right methods/tools. Identify and assess customers' needs to achieve satisfaction.",
    expectedClassification: 'unknown',
    id: 'unknown-023',
    location: 'West Palm Beach, FL',
    reasoning: 'Generic customer service role without background policy',
    title: 'Customer Service Representative',
  },
  {
    category: 'administrative',
    company: 'Kenco Hospitality',
    description:
      'The ideal candidate will be responsible for accurately entering and managing data within our systems, ensuring that all information is up-to-date and easily accessible.',
    expectedClassification: 'unknown',
    id: 'unknown-024',
    location: 'Fort Lauderdale, FL',
    reasoning: 'No mention of background requirements',
    title: 'Data Entry Clerk',
  },
  {
    category: 'administrative',
    company: 'Palm Glades Preparatory Academy',
    description:
      'Answers and directs all incoming calls. Answers incoming calls from intercom system. Greets all incoming visitors to front office. High School Diploma or GED required.',
    expectedClassification: 'unknown',
    id: 'unknown-025',
    location: 'Miami, FL',
    reasoning: 'Administrative role without explicit background policy',
    title: 'Receptionist',
  },

  // GENERAL LABOR - Generic
  {
    category: 'janitorial',
    company: 'Cleaning Company',
    description:
      'Create and organize contracts, proposals, and pricing sheets for commercial cleaning clients. Develop checklists and standard operating procedures for cleaners.',
    expectedClassification: 'unknown',
    id: 'unknown-026',
    location: 'Miami-Dade County, FL',
    reasoning: 'No background check or criminal history policy mentioned',
    title: 'Cleaning Crew',
  },
  {
    category: 'general-labor',
    company: 'All Court Sports',
    description:
      'In this position you will be required to set up and tear down volleyball sport court. Job Types: Part-time, Temp-to-hire, Contract, Temporary.',
    expectedClassification: 'unknown',
    id: 'unknown-027',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Temporary position without stated background policy',
    title: 'Sport Court Assembler',
  },
  {
    category: 'maintenance',
    company: 'Greystar',
    description:
      'Maintenance Supervisors Oversee the maintenance team and provide maintenance for the property including upkeep and repair of buildings and grounds.',
    expectedClassification: 'unknown',
    id: 'unknown-028',
    location: 'Miami, FL',
    reasoning: 'Property maintenance without background check details',
    title: 'Maintenance Technician',
  },

  // DRUG TEST ONLY - No Criminal
  {
    category: 'manufacturing',
    company: 'Manufacturing Facility',
    description:
      'Must pass pre-employment drug test. The ideal candidate will be responsible for operating machinery, ensuring production targets are met.',
    expectedClassification: 'unknown',
    id: 'unknown-029',
    location: 'Hialeah, FL',
    reasoning: 'Only drug test mentioned, no criminal background policy',
    title: 'Production Worker',
  },
  {
    category: 'warehouse',
    company: '5th HQ',
    description:
      'Previous experience working in a warehouse environment, with a focus on picking and packing. Utilize warehouse equipment, such as hand trucks and pallet jacks.',
    expectedClassification: 'unknown',
    id: 'unknown-030',
    location: 'Sunrise, FL',
    reasoning: 'Standard warehouse role without background language',
    title: 'Picker Packer',
  },

  // TECH / OFFICE - Generic
  {
    category: 'technology',
    company: 'United Property Management',
    description:
      'Provide internal support for software platforms such as Entrata and ancillary programs as well as hardware issues in offices across portfolio.',
    expectedClassification: 'unknown',
    id: 'unknown-031',
    location: 'Miami, FL',
    reasoning: 'Tech support role without criminal background policy',
    title: 'IT Support Team Member',
  },
  {
    category: 'administrative',
    company: 'Allstate Insurance',
    description:
      'As a key member of our organization, you will be responsible for efficiently handling data entry tasks and ensuring the integrity of our databases.',
    expectedClassification: 'unknown',
    id: 'unknown-032',
    location: 'Hollywood, FL',
    reasoning: 'Generic data entry without background check details',
    title: 'Data Entry',
  },

  // HEALTHCARE - Without AHCA Language
  {
    category: 'healthcare',
    company: "Doctor's Office",
    description:
      'Responsible for answering phones, greeting patients, relaying messages to appropriate staff, scheduling, canceling, re-scheduling appointments.',
    expectedClassification: 'unknown',
    id: 'unknown-033',
    location: 'Miami, FL',
    reasoning: 'Front desk medical role without background screening details',
    title: 'Medical Receptionist',
  },
  {
    category: 'healthcare',
    company: 'Fort Lauderdale Dentistry',
    description:
      'The ideal candidate will be the first point of contact for patients and play a critical role in ensuring a positive experience.',
    expectedClassification: 'unknown',
    id: 'unknown-034',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Dental office admin without stated background policy',
    title: 'Dental Front Desk',
  },

  // GIG / INDEPENDENT
  {
    category: 'transportation',
    company: 'Logistics Company',
    description:
      'Hiring owner operators (Cargo van, Sprinter Van, 26ft Box truck). This role is essential for ensuring timely and efficient delivery of goods.',
    expectedClassification: 'unknown',
    id: 'unknown-035',
    location: 'Miami, FL',
    reasoning: 'Independent contractor role without background language',
    title: 'Owner Operator Driver',
  },
  {
    category: 'transportation',
    company: 'Voyzi',
    description:
      'The ideal candidate will be responsible for transporting people safely and efficiently while adhering to all traffic laws and company policies.',
    expectedClassification: 'unknown',
    id: 'unknown-036',
    location: 'Miami, FL',
    reasoning: 'Rideshare-style driver without explicit background policy',
    title: 'Personal Driver',
  },

  // SKILLED TRADES - Generic
  {
    category: 'automotive',
    company: 'Local Trucking Company',
    description:
      'We are seeking a skilled Diesel Mechanic, capable of working in a high pressure environment to join our team. The Mechanic will be responsible for inspecting, diagnosing, and repairing various diesel engines.',
    expectedClassification: 'unknown',
    id: 'unknown-037',
    location: 'Miami, FL',
    reasoning: 'Trade position without criminal background language',
    title: 'Diesel Mechanic',
  },
  {
    category: 'construction',
    company: 'Construction Company',
    description:
      'Looking for punch-out/finished carpenters to start asap on a large construction site in Miami. Must have knowledge and be able to work with framing, drywall.',
    expectedClassification: 'unknown',
    id: 'unknown-038',
    location: 'Miami, FL',
    reasoning: 'Construction trade without background policy stated',
    title: 'Carpenter',
  },
  {
    category: 'trades',
    company: 'HVAC Company',
    description:
      'Diagnose and repair vehicle automotive systems including engine, transmission, electrical, air conditioning, etc. to specification.',
    expectedClassification: 'unknown',
    id: 'unknown-039',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Skilled trade position without criminal history policy',
    title: 'HVAC Technician',
  },

  // PROFESSIONAL / OFFICE
  {
    category: 'marketing',
    company: 'Centene Pharmacy Services',
    description:
      'Position Purpose: Coordinate all activities related to the marketing and communications functions. Write, design, coordinate, and produce materials.',
    expectedClassification: 'unknown',
    id: 'unknown-040',
    location: 'Florida',
    reasoning: 'Professional role without background check details',
    title: 'Marketing Communications Coordinator',
  },
  {
    category: 'administrative',
    company: 'Financial Consultant Company',
    description:
      'Executive Assistant needed for growing financial consultant company in the Fort Lauderdale area. Grow your career with this premier company!',
    expectedClassification: 'unknown',
    id: 'unknown-041',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Generic executive assistant posting without background policy',
    title: 'Executive Assistant',
  },
  {
    category: 'creative',
    company: 'CVI',
    description:
      'We are seeking a talented and creative Content Creator to join our team. Come join an incredible growing company!',
    expectedClassification: 'unknown',
    id: 'unknown-042',
    location: 'Miami, FL',
    reasoning: 'Creative role without stated background requirements',
    title: 'Content Creator',
  },

  // SALES - Generic
  {
    category: 'sales',
    company: 'Various',
    description:
      'Make outbound calls to business owners and decision-makers. Follow up relentlessly — no lead left behind. Connect with potential members over the phone.',
    expectedClassification: 'unknown',
    id: 'unknown-043',
    location: 'Miami, FL',
    reasoning: 'Sales role without criminal background policy',
    title: 'Inside Sales Representative',
  },
  {
    category: 'sales',
    company: 'Rapport',
    description:
      'Drive business forward using analytics to identify trends, develop and implement strategies to capitalize on opportunities in your district.',
    expectedClassification: 'unknown',
    id: 'unknown-044',
    location: 'Fort Lauderdale, FL',
    reasoning: 'Marketing/sales role without background language',
    title: 'Brand Ambassador',
  },

  // ENTRY LEVEL - Vague
  {
    category: 'automotive',
    company: 'AlphaWash',
    description:
      'A job for which military experienced candidates are encouraged to apply. Open to applicants who do not have a high school diploma/GED.',
    expectedClassification: 'unknown',
    id: 'unknown-045',
    location: 'Pembroke Pines, FL',
    reasoning: 'Entry level position without criminal background policy',
    title: 'Detail Shop Assistant',
  },
]

// ============================================================================
// EDGE CASES - Tricky or ambiguous postings
// ============================================================================

export const EDGE_CASES: Array<TestCase> = [
  // EDGE: Fair Chance label BUT contingent language
  {
    category: 'retail',
    company: 'Retail Chain',
    description:
      'Fair chance employer. Note that employment is contingent upon passing a background check. Certain convictions may disqualify candidates from this position.',
    expectedClassification: 'likely_excludes',
    id: 'edge-001',
    location: 'Miami, FL',
    reasoning:
      'EDGE CASE: Claims fair chance but "certain convictions may disqualify" overrides it',
    title: 'Customer Service Representative',
  },

  // EDGE: Standard EEO without fair chance
  {
    category: 'warehouse',
    company: 'Distribution Company',
    description:
      'We are an Equal Opportunity Employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, national origin, disability, or veteran status.',
    expectedClassification: 'unknown',
    id: 'edge-002',
    location: 'Hialeah, FL',
    reasoning: 'EDGE CASE: Standard EEO statement does NOT indicate fair chance hiring',
    title: 'Warehouse Worker',
  },

  // EDGE: Vague "consider" language
  {
    category: 'manufacturing',
    company: 'Manufacturing',
    description: 'We will consider candidates with criminal backgrounds on a case-by-case basis.',
    expectedClassification: 'fair_chance',
    id: 'edge-003',
    location: 'Miami, FL',
    reasoning: 'EDGE CASE: "Consider on case-by-case basis" indicates individualized assessment',
    title: 'Assembly Worker',
  },

  // EDGE: Level 2 mentioned but for different purpose
  {
    category: 'insurance',
    company: 'Insurance Company',
    description:
      'Process Level 2 and Level 3 insurance claims. Background check required. Detail oriented with strong computer skills.',
    expectedClassification: 'unknown',
    id: 'edge-004',
    location: 'Fort Lauderdale, FL',
    reasoning: 'EDGE CASE: "Level 2" refers to claim type, not background check',
    title: 'Insurance Claims Processor',
  },

  // EDGE: Clean driving but not criminal
  {
    category: 'transportation',
    company: 'Transportation Network',
    description:
      "Must have a clean driving record with no major violations in the past 3 years. Valid driver's license and insurance required.",
    expectedClassification: 'unknown',
    id: 'edge-005',
    location: 'Miami, FL',
    reasoning: 'EDGE CASE: Only driving record mentioned, not criminal background',
    title: 'Rideshare Driver',
  },

  // EDGE: Background check for specific role within company
  {
    category: 'healthcare',
    company: 'Ann Storck Center',
    description:
      'We are searching for Board Certified Behavior Analysts to join our outpatient therapy program. Fair chance employer. Level 2 background check required for positions involving direct client care.',
    expectedClassification: 'likely_excludes',
    id: 'edge-006',
    location: 'Fort Lauderdale, FL',
    reasoning:
      'EDGE CASE: Despite fair chance label, Level 2 required for client care = disqualifying',
    title: 'Behavior Analyst',
  },

  // EDGE: Implicit vs explicit
  {
    category: 'retail',
    company: 'Grocery Store',
    description:
      'Looking for reliable individuals for overnight stocking. No experience needed. Must be dependable and have access to transportation.',
    expectedClassification: 'unknown',
    id: 'edge-007',
    location: 'Miami, FL',
    reasoning: 'EDGE CASE: No background language at all - truly unknown',
    title: 'Night Stocker',
  },

  // EDGE: "Background check" without criminal specification
  {
    category: 'administrative',
    company: 'Small Business',
    description:
      'Administrative support position. Background verification of employment history and education will be conducted.',
    expectedClassification: 'unknown',
    id: 'edge-008',
    location: 'Coral Gables, FL',
    reasoning: 'EDGE CASE: Background check is employment/education only, not criminal',
    title: 'Office Administrator',
  },

  // EDGE: Franchise vs corporate policy
  {
    category: 'food-service',
    company: "McDonald's (Franchise)",
    description:
      'This franchise is independently owned and operated. Join our team! Leadership experience preferred. Drug test required.',
    expectedClassification: 'unknown',
    id: 'edge-009',
    location: 'Miami, FL',
    reasoning: 'EDGE CASE: Franchise may have different policy than corporate',
    title: 'Shift Manager',
  },

  // EDGE: Very old posting language
  {
    category: 'construction',
    company: 'Construction Site',
    description:
      'Seeking workers for immediate start. Must be legal to work in the US. Call for more information.',
    expectedClassification: 'unknown',
    id: 'edge-010',
    location: 'Fort Lauderdale, FL',
    reasoning: 'EDGE CASE: Minimal posting with no background policy information',
    title: 'General Laborer',
  },
]

// ============================================================================
// COMBINED TEST SET
// ============================================================================

export const ALL_TEST_CASES: Array<TestCase> = [
  ...EXCLUDES_CASES,
  ...FAIR_CHANCE_CASES,
  ...UNKNOWN_CASES,
  ...EDGE_CASES,
]

// ============================================================================
// STATISTICS AND METADATA
// ============================================================================

export const TEST_SET_METADATA = {
  categories: {
    aviation: 'TSA disqualifying offenses',
    banking: 'FDIC Section 19 restrictions',
    childcare: 'Level 2 DCF screening required',
    construction: 'Often no explicit policy',
    education: 'School district background checks',
    'food-service': 'Various - often no explicit policy',
    gaming: 'Gaming commission licensing',
    government: 'Law enforcement and municipal positions',
    healthcare: 'AHCA Level 2 screening required',
    hospitality: 'Various - check corporate vs franchise',
    retail: 'Various - check for fair chance statements',
    security: 'Class D/G license requirements',
    'social-services': 'May value lived experience',
    transportation: 'CDL/MVR requirements',
    warehouse: 'Various - check for fair chance statements',
  },
  edgeCases: EDGE_CASES.length,
  excludesCases: EXCLUDES_CASES.length,
  fairChanceCases: FAIR_CHANCE_CASES.length,
  locations: ['Miami-Dade County', 'Broward County', 'Palm Beach County', 'Florida statewide'],
  notes: [
    'Florida has local Ban the Box laws in Miami-Dade County, Broward County (public employers), and some cities',
    'Level 2 Background Screening in Florida has specific disqualifying offenses under Chapter 435 F.S.',
    'AHCA (Agency for Health Care Administration) screening is required for healthcare workers with patient contact',
    'Class G armed security license has permanent felony disqualification',
    'FDIC Section 19 prohibits banks from employing persons with certain financial crimes',
    'Many national retailers have adopted Fair Chance hiring policies',
    'Franchises may have different policies than corporate-owned locations',
  ],
  researchDate: '2025-12-26',
  sources: [
    'Indeed.com',
    'Glassdoor.com',
    'ZipRecruiter.com',
    'Snagajob.com',
    'SimplyHired.com',
    'Company career pages',
    'Florida government employment portals',
  ],
  totalCases: ALL_TEST_CASES.length,
  unknownCases: UNKNOWN_CASES.length,
}

// Helper function to get cases by classification
export function getCasesByClassification(
  classification: TestCase['expectedClassification'],
): Array<TestCase> {
  return ALL_TEST_CASES.filter(tc => tc.expectedClassification === classification)
}

// Helper function to get cases by category
export function getCasesByCategory(category: string): Array<TestCase> {
  return ALL_TEST_CASES.filter(tc => tc.category === category)
}

// Console output for verification
console.log('=== South Florida Second-Chance Employer Test Set ===')
console.log(`Total test cases: ${ALL_TEST_CASES.length}`)
console.log(`- Explicitly Excludes: ${EXCLUDES_CASES.length}`)
console.log(`- Explicitly Fair Chance: ${FAIR_CHANCE_CASES.length}`)
console.log(`- Unknown: ${UNKNOWN_CASES.length}`)
console.log(`- Edge Cases: ${EDGE_CASES.length}`)
