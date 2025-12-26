/**
 * Realistic test cases for second-chance LLM classification
 *
 * Generated from web research of actual job postings on Indeed, ZipRecruiter,
 * company career pages, and industry-specific hiring requirements.
 *
 * These test cases capture authentic language patterns found in real job descriptions.
 */

export interface TestCase {
  name: string
  description: string
  expectedStance: 'fair_chance' | 'likely_excludes' | 'unknown'
}

// ============================================================================
// EXPLICITLY_EXCLUDES: Jobs with clear exclusionary language
// Includes regulatory bars (FDIC, childcare, gaming), explicit restrictions,
// and "fair chance" labels that contradict with contingent/exclusionary language
// ============================================================================

export const EXCLUDES_CASES: TestCase[] = [
  {
    description: `
Bank Teller - First National Bank

Join our growing team! We offer competitive pay starting at $17/hour plus benefits.

Responsibilities:
- Process customer deposits, withdrawals, and payments
- Maintain accurate cash drawer
- Cross-sell bank products and services
- Provide exceptional customer service

Requirements:
- High school diploma or GED
- Cash handling experience preferred
- Strong math and communication skills
- Must pass comprehensive background check

In accordance with Section 19 of the Federal Deposit Insurance Act, candidates with convictions involving dishonesty, breach of trust, or money laundering are ineligible for employment. All offers contingent upon successful completion of criminal background check and credit history review.
    `,
    expectedStance: 'likely_excludes',
    name: 'FDIC-regulated bank teller with Section 19 reference',
  },
  {
    description: `
Lead Preschool Teacher - Little Stars Learning Center

We're looking for passionate educators to join our team!

$16-$20/hour based on experience and credentials. Full benefits package.

Qualifications:
- CDA credential or Associate's in Early Childhood Education
- First Aid/CPR certification
- Genuine love for working with children ages 2-5

All candidates must:
- Complete fingerprint-based FBI background check
- Pass state child abuse registry screening
- Clear sex offender registry check
- Have no disqualifying criminal convictions as defined by state childcare licensing regulations

Child safety is our top priority. Individuals with any history of crimes against children or vulnerable populations will not be considered.
    `,
    expectedStance: 'likely_excludes',
    name: 'Childcare worker with fingerprint and registry requirements',
  },
  {
    description: `
Armed Security Officer - Premier Protection Services

Now Hiring! $22-$28/hour DOE

Protect corporate facilities and executive personnel in the downtown business district.

Requirements:
- Valid state security guard license
- Must obtain armed guard certification within 30 days
- 2+ years security experience preferred
- Professional appearance and demeanor

Must pass extensive background investigation including:
- Criminal history check (felony convictions are disqualifying)
- Drug screening
- Psychological evaluation

Candidates with any felony convictions or misdemeanor crimes involving violence, theft, or moral turpitude are ineligible for licensure per state regulations.
    `,
    expectedStance: 'likely_excludes',
    name: 'Armed security guard with licensing restrictions',
  },
  {
    description: `
CDL-A Driver - Regional Routes

Home Weekly! Great Pay!

Earn $0.58-$0.65 CPM based on experience. Average $1,400-$1,800/week.

Benefits:
- Medical, dental, vision insurance
- 401k with company match
- Paid vacation and holidays

Requirements:
- Valid CDL-A license with 1+ year experience
- Clean MVR - no major violations in past 3 years
- Must have clean driving and criminal record
- Ability to pass DOT physical and drug screen
- No DUI/DWI convictions

Apply today and start your journey with America's most trusted freight company!
    `,
    expectedStance: 'likely_excludes',
    name: 'CDL driver with clean record requirement',
  },
  {
    description: `
Certified Nursing Assistant (CNA) - Sunrise Senior Living

Make a difference in the lives of our residents!

$15-$18/hour plus shift differentials. Generous PTO and health benefits.

We're seeking compassionate CNAs for our skilled nursing facility.

Requirements:
- Active CNA certification
- BLS/CPR certification
- Ability to lift 50+ lbs

Background Check Requirements:
All employees must pass state-mandated criminal background check. Per state healthcare regulations, the following offenses are disqualifying:
- Any violent felony
- Crimes involving abuse, neglect, or exploitation
- Theft or fraud offenses
- Drug-related felonies within the past 10 years

We are committed to providing safe care for our vulnerable population.
    `,
    expectedStance: 'likely_excludes',
    name: 'Healthcare facility with disqualifying offense list',
  },
  {
    description: `
Substitute Teacher - Jefferson County School District

Flexible scheduling! Make $150-$200/day.

Looking for dedicated individuals to serve as substitute teachers across our K-12 schools.

Minimum Requirements:
- Bachelor's degree in any field
- Valid teaching certificate OR substitute permit
- Strong communication skills

Mandatory Background Requirements:
Per state education code, all school personnel must:
- Complete FBI fingerprint background check
- Pass state criminal history review
- Clear child abuse/neglect registry

Individuals with any felony conviction or any misdemeanor involving moral turpitude, violence, or crimes against minors are permanently barred from school employment. No exceptions.
    `,
    expectedStance: 'likely_excludes',
    name: 'School district with mandatory exclusions',
  },
  {
    description: `
Pharmacy Technician - CVS Health

$16-$20/hour. Comprehensive benefits. Career growth opportunities.

As a Pharmacy Tech, you'll assist pharmacists in preparing and dispensing medications while providing excellent customer service.

Responsibilities:
- Fill prescription orders accurately
- Manage inventory and stock shelves
- Process insurance claims
- Assist customers at pickup counter

Requirements:
- Pharmacy technician certification (or ability to obtain within 90 days)
- Strong attention to detail
- Ability to stand for extended periods

Candidates must meet State Board of Pharmacy requirements. Criminal convictions involving controlled substances, drug diversion, theft, or fraud will result in denial of technician registration. Background check required.
    `,
    expectedStance: 'likely_excludes',
    name: 'Pharmacy tech with Board of Pharmacy restrictions',
  },
  {
    description: `
Retail Sales Associate - Major Department Store

Starting at $15.50/hour. Employee discount and flexible scheduling!

Join our team and help customers find what they love.

Responsibilities:
- Greet customers and provide product recommendations
- Process transactions and handle returns
- Maintain store appearance and stock merchandise
- Meet sales goals

We are a Fair Chance Employer and consider qualified applicants with criminal histories.

All offers of employment are contingent upon successful completion of a background check, which includes verification of criminal history. Candidates with convictions for theft, fraud, or violent crimes may be disqualified based on the nature and recency of the offense.
    `,
    expectedStance: 'likely_excludes',
    name: 'Mixed messaging - Fair chance label with contingent language',
  },
  {
    description: `
Systems Administrator - Defense Contractor

Support critical national security infrastructure!

Salary: $85,000-$110,000 depending on experience and clearance level.

Responsibilities:
- Maintain classified network infrastructure
- Implement security protocols per DOD guidelines
- Provide technical support to cleared personnel
- Monitor systems for security incidents

Requirements:
- Active Secret or Top Secret clearance (or ability to obtain)
- 5+ years systems administration experience
- Security+ certification minimum
- Bachelor's degree in IT or related field

Security Clearance Requirements:
Position requires eligibility for security clearance. Candidates with felony convictions, drug offenses, or financial issues may be disqualified during the adjudication process. All candidates subject to comprehensive background investigation including criminal history, credit check, and interviews with references.
    `,
    expectedStance: 'likely_excludes',
    name: 'Government contractor with security clearance',
  },
  {
    description: `
Maintenance Technician - Greystar Property Management

$18-$24/hour based on experience. On-call rotation required.

Maintain our luxury apartment community and ensure resident satisfaction.

Duties:
- Perform routine and emergency maintenance repairs
- Turn units between residents
- Maintain pool and common areas
- Respond to after-hours emergencies

Requirements:
- 2+ years maintenance experience
- HVAC certification preferred
- Valid driver's license
- Own basic hand tools

This position requires unsupervised access to resident units. Candidates must pass criminal background check. Applicants with any conviction involving theft, burglary, assault, or sexual offenses will not be considered for positions requiring unit access.
    `,
    expectedStance: 'likely_excludes',
    name: 'Property management with tenant access concerns',
  },
  {
    description: `
Home Health Aide - Comfort Keepers

$14-$17/hour plus mileage reimbursement.

Provide compassionate in-home care to seniors and individuals with disabilities.

Duties:
- Assist with activities of daily living
- Light housekeeping and meal preparation
- Companionship and emotional support
- Medication reminders

Requirements:
- HHA certification or CNA license
- Reliable transportation and valid driver's license
- Compassionate and patient demeanor

Background Requirements:
For the protection of our vulnerable clients, all caregivers must pass:
- State and national criminal background check
- Sex offender registry check
- Abuse registry screening

Convictions for abuse, neglect, exploitation, theft, or violent crimes are disqualifying. No felonies within the past 7 years.
    `,
    expectedStance: 'likely_excludes',
    name: 'Home health aide with patient safety restrictions',
  },
  {
    description: `
Cashier/Vault Attendant - Lucky Strike Casino

$16/hour plus tips. Exciting gaming environment!

Handle large cash transactions in our high-volume casino.

Responsibilities:
- Process chip purchases and redemptions
- Verify large bills and detect counterfeits
- Maintain accurate cash drawer
- Provide excellent guest service

Requirements:
- 1+ year cash handling experience
- Basic math skills
- Ability to work nights, weekends, and holidays

Gaming Commission Requirements:
All casino employees must obtain gaming license. Background check required. Automatic disqualifiers include:
- Felony convictions within past 10 years
- Any theft, fraud, or embezzlement conviction (regardless of date)
- Outstanding warrants or pending charges
    `,
    expectedStance: 'likely_excludes',
    name: 'Casino vault with gaming commission requirements',
  },
  {
    description: `
Delivery Driver - Pizza Palace

$12/hour + tips (average $18-$25/hour total). Flexible evening hours.

Deliver delicious pizza to hungry customers in our delivery zone!

What You Need:
- Valid driver's license with clean record
- Reliable personal vehicle with insurance
- Smartphone for delivery app
- Friendly attitude

Must pass background check and drug screen.

Note: Due to insurance requirements, we cannot hire applicants with any felony convictions or DUI/DWI within the past 5 years. This policy applies to all driving positions.
    `,
    expectedStance: 'likely_excludes',
    name: 'Delivery driver with blanket felony exclusion',
  },
  {
    description: `
Financial Advisor Trainee - Edward Jones

Launch your career in wealth management!

First year earnings potential: $50,000-$80,000

We provide comprehensive training and support to help you build a successful practice helping clients achieve their financial goals.

What We Offer:
- Paid training program
- Mentorship from experienced advisors
- Full benefits package
- Unlimited earning potential

Requirements:
- Bachelor's degree (any major)
- Strong interpersonal skills
- Entrepreneurial mindset
- Series 7 and 66 (or ability to obtain)

FINRA Registration Requirements:
Per FINRA rules, individuals with felony convictions within the past 10 years, or any conviction involving securities violations, theft, or dishonesty are statutorily disqualified from registration. Comprehensive background check and fingerprinting required.
    `,
    expectedStance: 'likely_excludes',
    name: 'Financial advisor with FINRA disqualification',
  },
  {
    description: `
Insurance Sales Agent - State Farm

Unlimited earning potential! Base + commission.

Build your career helping families protect what matters most.

What We Offer:
- Comprehensive training program
- Competitive base salary plus uncapped commissions
- Health, dental, and vision insurance
- 401k with matching

Requirements:
- Property & Casualty license (or ability to obtain)
- Life & Health license (or ability to obtain)
- Strong sales and communication skills
- Bachelor's degree preferred

Licensing Requirements:
Per state insurance regulations, applicants with felony convictions involving dishonesty, breach of trust, or money crimes within the past 10 years are ineligible for licensure. Comprehensive background investigation required.
    `,
    expectedStance: 'likely_excludes',
    name: 'Insurance agent with licensure restrictions',
  },
]

// ============================================================================
// EXPLICITLY_FAIR_CHANCE: Jobs with clear second-chance friendly language
// Includes open hiring, fair chance statements, reentry partnerships,
// and explicit "felony friendly" language
// ============================================================================

export const FAIR_CHANCE_CASES: TestCase[] = [
  {
    description: `
Baker/Production Worker - Community Bakery Co.

$17/hour to start. Full benefits after 90 days.

Join our award-winning bakery known for our delicious artisan breads and commitment to our community.

We practice Open Hiring - no resume, no interview, no background check required. We believe everyone deserves a chance to work.

The only requirements:
- Ability to lift 50 lbs
- Willingness to work early morning or overnight shifts
- Desire to learn and grow

Add your name to our hiring list and we'll call you when a position opens. Training provided.

We are a certified B Corp committed to inclusive employment practices.
    `,
    expectedStance: 'fair_chance',
    name: 'Greyston-style open hiring bakery',
  },
  {
    description: `
Construction Laborer - BuildRight Construction

$20-$28/hour based on experience. Weekly pay!

We're hiring immediately for commercial construction projects.

Duties:
- Site cleanup and preparation
- Material handling and delivery
- Assist skilled tradespeople
- Operate hand and power tools

Requirements:
- Reliable transportation to job sites
- Steel toe boots
- Ability to work outdoors in all weather
- Must be able to lift 75 lbs

We believe in second chances. Felony friendly - we do not automatically disqualify applicants based on criminal history. Your past doesn't define your future. Come build something great with us.
    `,
    expectedStance: 'fair_chance',
    name: 'Construction company with explicit felony friendly statement',
  },
  {
    description: `
Warehouse Associate - Distribution Dynamics

$18.50/hour + $2 shift differential for nights. Benefits from day one.

Join our fast-paced distribution center team!

Responsibilities:
- Pick, pack, and ship customer orders
- Operate RF scanner and warehouse equipment
- Maintain inventory accuracy
- Meet productivity standards

Requirements:
- Ability to stand 10+ hours
- Must be able to lift up to 50 lbs regularly
- Reliable attendance
- High school diploma or GED

Fair Chance Employer Statement:
We are a proud Fair Chance Employer. We conduct an individualized assessment of each candidate and do not automatically disqualify anyone based on criminal history. A record does not prevent you from being hired here. We evaluate the nature of the offense, time elapsed, and relevance to the job.
    `,
    expectedStance: 'fair_chance',
    name: 'Warehouse with fair chance and individualized assessment',
  },
  {
    description: `
Line Cook - Flavor Town Kitchen

$16-$19/hour based on experience. Free meals and flexible scheduling.

We're looking for talented cooks to join our scratch kitchen!

What You'll Do:
- Prepare menu items to spec during high-volume service
- Maintain station cleanliness and organization
- Follow food safety protocols
- Work collaboratively with kitchen team

What You Need:
- 1+ year cooking experience (preferred but not required)
- Ability to work in fast-paced environment
- Passion for food
- Reliable transportation

We Are a Second Chance Employer
Everyone deserves an opportunity. We welcome applicants with criminal backgrounds and do not ask about conviction history on our application. We evaluate candidates based on their skills, work ethic, and potential - not their past mistakes.
    `,
    expectedStance: 'fair_chance',
    name: 'Restaurant chain with explicit second chance policy',
  },
  {
    description: `
Peer Recovery Support Specialist - Hope Recovery Center

$18-$22/hour. Monday-Friday, no weekends.

Help others on their recovery journey by sharing your lived experience.

About the Role:
- Provide peer support to individuals in recovery
- Facilitate support groups
- Connect clients with community resources
- Model recovery and wellness

Qualifications:
- Personal experience with recovery from substance use disorder
- Minimum 2 years in sustained recovery
- CPRS certification (or ability to obtain within 6 months)
- Strong communication and empathy skills

Justice-involved individuals are encouraged to apply. We value lived experience with the criminal justice system as it enhances your ability to connect with and support our clients. Your past is an asset here, not a barrier.
    `,
    expectedStance: 'fair_chance',
    name: 'Peer support specialist with lived experience valued',
  },
  {
    description: `
Mover/Driver Helper - Fresh Start Moving Co.

$15-$20/hour plus tips. Great workout and good money!

Join our professional moving team.

Duties:
- Load and unload household goods
- Wrap and protect furniture
- Provide excellent customer service
- Assist with driving (CDL not required for helpers)

Requirements:
- Ability to lift 100 lbs with assistance
- Positive attitude and strong work ethic
- Reliable and punctual
- Valid ID required

We proudly partner with local reentry programs and welcome formerly incarcerated individuals to apply. We know that a job can be the key to successful reintegration. Returning citizens welcome - your willingness to work hard matters more than your record.
    `,
    expectedStance: 'fair_chance',
    name: 'Moving company with reentry program partnership',
  },
  {
    description: `
Production Operator - Precision Parts Manufacturing

$19/hour to start with increases at 90 days and 1 year. Full benefits.

Operate CNC machinery and quality inspection equipment.

Responsibilities:
- Set up and operate production equipment
- Perform quality checks per specifications
- Document production data
- Maintain clean and safe work area

Requirements:
- Mechanical aptitude
- Ability to read blueprints and use measuring tools
- High school diploma or GED
- Reliable attendance is essential

Ban the Box Employer: We have removed the criminal history question from our application. A criminal record will not automatically disqualify you from consideration. We believe in giving everyone a fair chance to demonstrate their abilities and contribute to our team.
    `,
    expectedStance: 'fair_chance',
    name: 'Manufacturing with Ban the Box and no automatic disqualification',
  },
  {
    description: `
Landscaping Crew Member - Green Thumb Services

$16-$20/hour. Seasonal bonuses available.

Work outdoors making properties beautiful!

What You'll Do:
- Mowing, edging, and trimming
- Mulching and planting
- Leaf and debris removal
- Snow removal in winter months

What We Need:
- Ability to work outdoors in heat
- Physical stamina for demanding work
- Valid driver's license preferred
- Early morning availability

Background Friendly - All Backgrounds Welcome
We give everyone a fair shot. If you're ready to work hard and show up every day, we want to talk to you. No judgment about your past. What matters is your future with us.
    `,
    expectedStance: 'fair_chance',
    name: 'Landscaping with background friendly explicit statement',
  },
  {
    description: `
General Labor - Ready Workforce Staffing

Immediate Openings! $14-$18/hour. Weekly pay!

We have temp-to-hire positions available at multiple client sites including:
- Warehouse work
- Manufacturing
- Packaging
- General labor

Requirements:
- 18 years or older
- Reliable transportation
- Ability to pass drug screen
- Steel toe boots for some positions

WE HIRE FELONS. Yes, you read that right. We believe in second chances and partner with clients who do too. Your criminal record doesn't automatically disqualify you here. Come in, let us match you with the right opportunity.
    `,
    expectedStance: 'fair_chance',
    name: 'Staffing agency with explicit we hire felons',
  },
  {
    description: `
Housekeeper - Marriott Select Service Hotel

$15/hour plus room discounts worldwide. Benefits available.

Keep our hotel sparkling clean for guests!

Duties:
- Clean and prepare guest rooms
- Replace linens and amenities
- Vacuum, dust, and sanitize
- Report maintenance issues

Requirements:
- Attention to detail
- Ability to work on your feet all day
- Reliable and punctual
- Weekend availability required

Marriott Commitment to Fair Chance Hiring:
Marriott is committed to giving all qualified individuals a fair chance. We do not conduct background checks until a conditional offer is made. Even then, criminal history is considered only as it relates to the position. A past conviction does not automatically exclude you from joining the Marriott family.
    `,
    expectedStance: 'fair_chance',
    name: 'Hotel housekeeping with commitment to fair consideration',
  },
  {
    description: `
Roofer - Top Notch Roofing

$22-$35/hour based on experience. Cash bonuses for completed jobs.

Experienced roofers and willing-to-learn laborers needed!

What We Do:
- Residential and commercial roofing
- Tear-offs and new installations
- Repairs and maintenance

What You Need:
- Comfortable working at heights
- Reliable transportation to job sites
- Physical fitness for demanding work
- No fear of hard work

We Hire People With Records
Plenty of our best guys have a past. What matters is showing up on time, working hard, and doing quality work. We don't care what you did before - we care what you do now. If you want to build a career in roofing, we'll give you the chance.
    `,
    expectedStance: 'fair_chance',
    name: 'Roofing company explicit about hiring people with records',
  },
  {
    description: `
Dishwasher/Prep Cook - Iron Chef Restaurant Group

$14-$16/hour. Free shift meals. Room to grow.

Start your culinary career with us!

Duties:
- Operate industrial dishwashing equipment
- Maintain clean dish area
- Assist with basic food prep
- Help kitchen staff as needed

Requirements:
- Ability to work in hot, fast-paced environment
- Stand for 8+ hour shifts
- Flexible schedule including nights and weekends
- Positive attitude

Fair Chance Policy:
Iron Chef Restaurant Group does not disqualify applicants based on arrest records, sealed records, or expunged convictions. For other criminal history, we conduct an individualized assessment considering the offense, time passed, and job relevance. We believe in second chances.
    `,
    expectedStance: 'fair_chance',
    name: 'Restaurant group with clear no automatic disqualification policy',
  },
  {
    description: `
Commercial Cleaner - Clean Slate Janitorial Services

$14-$17/hour. Evening shifts available.

Clean office buildings and commercial spaces.

Responsibilities:
- Vacuum and mop floors
- Clean restrooms and break rooms
- Empty trash and recycling
- Dust and wipe surfaces

Requirements:
- Reliable transportation
- Ability to work independently
- Pass drug test
- Attention to detail

Our Mission:
Clean Slate Janitorial was founded to provide meaningful employment opportunities for individuals facing barriers to employment, including those with criminal records. We partner with local reentry organizations and welcome applications from recently released individuals. Your past doesn't define you - your work ethic does.
    `,
    expectedStance: 'fair_chance',
    name: 'Janitorial services with reentry focus',
  },
  {
    description: `
Forklift Operator - Express Employment Professionals

$17-$20/hour. Immediate starts available!

We're placing forklift operators at warehouses throughout the area.

Requirements:
- Valid forklift certification
- 1+ year sit-down forklift experience
- Ability to work overtime as needed
- Reliable transportation

Express Employment is a Fair Chance employer. We evaluate candidates based on their qualifications and do not automatically reject applicants with criminal records. Many of our client companies are also committed to fair chance hiring. Don't let your past stop you from applying.
    `,
    expectedStance: 'fair_chance',
    name: 'Temp agency with explicit fair chance statement',
  },
  {
    description: `
Recycling Sorter - EcoWorks Recycling Center

$15/hour. Monday-Friday daytime hours.

Help the environment while earning a paycheck!

Job Duties:
- Sort recyclable materials on conveyor belt
- Remove contaminants from recycling stream
- Bale and prepare materials for shipping
- Maintain clean and safe work area

Requirements:
- Ability to stand for full shift
- Work in varying temperatures
- Lift up to 50 lbs
- Reliable attendance

EcoWorks Social Enterprise:
We are a nonprofit social enterprise with a mission to provide transitional employment to individuals facing barriers. Justice-impacted individuals are encouraged to apply. We provide job training, support services, and a pathway to permanent employment. No background check required for most positions.
    `,
    expectedStance: 'fair_chance',
    name: 'Recycling center with community employment mission',
  },
]

// ============================================================================
// UNKNOWN: Jobs with no clear signals either way
// Generic postings, vague background check mentions, standard EEO statements
// ============================================================================

export const UNKNOWN_CASES: TestCase[] = [
  {
    description: `
Sales Associate - Target

$15-$17/hour. Flexible scheduling and team member discount.

Create an exceptional shopping experience for our guests.

Responsibilities:
- Greet and assist guests
- Maintain product presentation standards
- Process transactions accurately
- Support inventory and stocking

Requirements:
- Friendly and customer-focused
- Ability to work flexible hours including weekends
- Stand and walk for extended periods
- 18 years or older

Benefits include health insurance, 401k, and 10% discount. Apply online today!
    `,
    expectedStance: 'unknown',
    name: 'Generic retail with no criminal mentions',
  },
  {
    description: `
Full Stack Developer - TechStartup Inc.

Remote friendly! Salary: $90,000-$130,000

Join our engineering team building the next generation of enterprise SaaS.

Tech Stack:
- React/TypeScript frontend
- Node.js/Python backend
- PostgreSQL, Redis
- AWS/Kubernetes

Requirements:
- 3+ years full stack development experience
- Strong JavaScript/TypeScript skills
- Experience with RESTful APIs and microservices
- CS degree or equivalent experience

Benefits:
- Equity compensation
- Unlimited PTO
- Home office stipend
- Health, dental, vision

We are an equal opportunity employer committed to diversity and inclusion.
    `,
    expectedStance: 'unknown',
    name: 'Software developer with standard requirements',
  },
  {
    description: `
Server - Olive Garden

$2.13/hour + tips (average $20-$30/hour)

Bring the warmth of the Italian table to our guests!

What You'll Do:
- Welcome guests and take orders
- Serve food and beverages
- Ensure guest satisfaction
- Maintain clean dining area

What We're Looking For:
- Previous serving experience preferred
- Positive and friendly personality
- Ability to multitask in fast-paced environment
- Available nights and weekends

We offer flexible scheduling, meal discounts, and opportunities for advancement. Background check may be conducted as part of hiring process.
    `,
    expectedStance: 'unknown',
    name: 'Restaurant server with generic background check mention',
  },
  {
    description: `
Administrative Assistant - Johnson & Associates Law Firm

$18-$22/hour. Full time M-F 8:30-5:00.

Support our busy legal practice with administrative duties.

Responsibilities:
- Answer phones and greet clients
- Schedule appointments and manage calendars
- Prepare correspondence and legal documents
- File and organize case materials
- General office management

Requirements:
- 2+ years administrative experience
- Proficiency in Microsoft Office Suite
- Professional appearance and demeanor
- Excellent written and verbal communication
- Associate's degree preferred

We offer competitive salary, health benefits, and paid time off. Pre-employment screening required.
    `,
    expectedStance: 'unknown',
    name: 'Office administrator with standard screening',
  },
  {
    description: `
Crew Member - McDonald's

Starting at $12/hour. Free meals and flexible hours.

Be part of the team that puts smiles on millions of faces every day!

Positions Available:
- Front counter/Drive-thru
- Grill/Kitchen
- Maintenance

What We're Looking For:
- Friendly and reliable
- Able to work in fast-paced environment
- Flexible availability
- No experience necessary - we'll train you!

Benefits include meal discounts, flexible scheduling, and advancement opportunities. Must be 16+ to apply. Drug test required.
    `,
    expectedStance: 'unknown',
    name: 'Fast food with only drug test mentioned',
  },
  {
    description: `
Front Desk Receptionist - Family Health Medical Group

$16-$19/hour. Full benefits after 60 days.

Be the welcoming face of our medical practice.

Duties:
- Greet patients and check them in
- Schedule appointments
- Verify insurance and collect copays
- Answer phones and relay messages
- Maintain patient confidentiality per HIPAA

Qualifications:
- Medical office experience preferred
- Knowledge of insurance verification
- Excellent customer service skills
- EMR experience (Epic or similar)
- High school diploma required

We are an equal opportunity employer. Standard pre-employment screening applies.
    `,
    expectedStance: 'unknown',
    name: 'Medical receptionist with generic compliance',
  },
  {
    description: `
Warehouse Worker - ABC Distribution

$16/hour. Multiple shifts available.

Join our distribution team!

Duties:
- Load and unload trucks
- Pick orders using RF scanner
- Pack boxes for shipment
- General warehouse tasks

Requirements:
- Ability to lift 50+ lbs repeatedly
- Stand and walk for 8-10 hours
- Basic math skills
- Reliable transportation
- Steel toe boots required

We offer weekly pay, health benefits, and opportunities for advancement. Apply in person or online.
    `,
    expectedStance: 'unknown',
    name: 'Warehouse with just physical requirements',
  },
  {
    description: `
Customer Service Representative - National Call Center

$15/hour + bonuses. Remote options available after training.

Help customers with their accounts and inquiries.

Responsibilities:
- Answer inbound customer calls
- Resolve issues and answer questions
- Document interactions in CRM
- Meet quality and productivity metrics

Requirements:
- High school diploma or GED
- Clear speaking voice
- Computer proficiency
- Ability to type 35+ WPM
- Reliable internet for remote work

We provide paid training, benefits, and a supportive team environment. Equal opportunity employer.
    `,
    expectedStance: 'unknown',
    name: 'Call center with standard equal opportunity',
  },
  {
    description: `
Delivery Driver - DoorDash

Be your own boss! Earn on your schedule.

Deliver food from local restaurants to hungry customers.

Requirements:
- Valid driver's license
- Reliable vehicle with insurance
- Smartphone with data plan
- 18 years or older

We check your driving record to ensure you meet our safety standards. Three years of driving history required.

Earn money on your schedule. Cash out daily with Fast Pay. Sign up today and start delivering!
    `,
    expectedStance: 'unknown',
    name: 'Rideshare driver with only driving record check',
  },
  {
    description: `
Barista - Local Coffee House

$13/hour + tips. Morning and afternoon shifts.

Craft delicious beverages and create a welcoming atmosphere.

What You'll Do:
- Prepare espresso drinks and brewed coffee
- Provide excellent customer service
- Maintain clean café environment
- Operate POS system

What We Need:
- Passion for coffee (experience a plus but not required)
- Friendly and outgoing personality
- Ability to work mornings starting at 5:30am
- Weekend availability

We're a small locally-owned shop that values our team. Free drinks on shift and flexible scheduling. Apply in person with your availability.
    `,
    expectedStance: 'unknown',
    name: 'Barista with no background language',
  },
  {
    description: `
Machine Operator - Plastics Manufacturing Inc.

$17-$21/hour. All shifts available.

Operate injection molding equipment.

Responsibilities:
- Set up and operate production machines
- Monitor product quality
- Perform minor maintenance
- Document production data

Requirements:
- Manufacturing experience preferred
- Ability to read blueprints and work orders
- Mechanical aptitude
- High school diploma or GED
- Reliable attendance

We offer competitive pay, health insurance, 401k, and opportunity for advancement. Pre-employment screening and physical may be required.
    `,
    expectedStance: 'unknown',
    name: 'Manufacturing with unspecified screening',
  },
  {
    description: `
Grocery Clerk - Publix Super Markets

$13-$15/hour. Part time and full time available.

Join our team and be part of the Publix family!

Duties:
- Stock shelves and rotate product
- Assist customers in finding items
- Operate cash register as needed
- Maintain department cleanliness

Qualifications:
- Friendly customer service skills
- Ability to lift 40 lbs
- Flexible schedule including weekends and holidays
- 18 years or older for full time

Publix is consistently ranked as one of the best places to work. We offer competitive pay, benefits, and employee stock ownership. Apply online today!
    `,
    expectedStance: 'unknown',
    name: 'Grocery store clerk generic posting',
  },
  {
    description: `
Automotive Technician - Jiffy Lube

$15-$25/hour based on certifications and experience.

Perform oil changes, tire rotations, and preventive maintenance.

Responsibilities:
- Perform quick lube services
- Inspect vehicles and recommend services
- Provide excellent customer service
- Maintain clean work area

Requirements:
- Valid driver's license
- Basic automotive knowledge
- ASE certifications a plus
- Ability to work on your feet

We provide training and ASE certification assistance. Career advancement opportunities available. Apply online or in person.
    `,
    expectedStance: 'unknown',
    name: 'Auto mechanic with licensing focus',
  },
  {
    description: `
Front Desk Agent - Holiday Inn Express

$14-$16/hour. Full time with benefits.

Be the first point of contact for our guests!

Duties:
- Check guests in and out
- Handle reservations and inquiries
- Resolve guest concerns
- Process payments
- Maintain lobby appearance

Requirements:
- Previous hospitality experience preferred
- Excellent customer service skills
- Computer proficiency
- Professional appearance
- Available nights, weekends, holidays

IHG offers competitive pay, hotel discounts worldwide, and career growth opportunities. We are an equal opportunity employer.
    `,
    expectedStance: 'unknown',
    name: 'Hotel front desk with generic professionalism',
  },
  {
    description: `
Dental Assistant - Smile Dental Care

$18-$22/hour based on experience. Mon-Thurs schedule.

Assist our dentists in providing excellent patient care.

Responsibilities:
- Chair-side assistance during procedures
- Take digital x-rays
- Sterilize instruments
- Schedule patient appointments
- Patient education

Requirements:
- Dental Assistant certification
- X-ray license
- CPR certification
- 1+ year experience preferred
- Bilingual Spanish a plus

We offer a great team environment, competitive pay, and full benefits. Credential verification required.
    `,
    expectedStance: 'unknown',
    name: 'Dental assistant with standard verification',
  },
]

// ============================================================================
// ALL TEST CASES COMBINED
// ============================================================================

export const ALL_TEST_CASES: TestCase[] = [
  ...EXCLUDES_CASES,
  ...FAIR_CHANCE_CASES,
  ...UNKNOWN_CASES,
]

export default ALL_TEST_CASES
