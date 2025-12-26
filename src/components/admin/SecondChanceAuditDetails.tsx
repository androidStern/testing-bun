/**
 * Second Chance Audit Details - Admin component for viewing full scoring breakdown
 * Displays all signals, contributions, and reasoning for a job's second-chance score
 */

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'

// O*NET Major Group Titles (2-digit code → human-readable name)
const ONET_MAJOR_GROUP_TITLES: Record<string, string> = {
  '11': 'Management',
  '13': 'Business & Financial Operations',
  '15': 'Computer & Mathematical',
  '17': 'Architecture & Engineering',
  '19': 'Life, Physical & Social Science',
  '21': 'Community & Social Service',
  '23': 'Legal',
  '25': 'Educational Instruction & Library',
  '27': 'Arts, Design, Entertainment, Sports & Media',
  '29': 'Healthcare Practitioners & Technical',
  '31': 'Healthcare Support',
  '33': 'Protective Service',
  '35': 'Food Preparation & Serving',
  '37': 'Building & Grounds Cleaning & Maintenance',
  '39': 'Personal Care & Service',
  '41': 'Sales & Related',
  '43': 'Office & Administrative Support',
  '45': 'Farming, Fishing & Forestry',
  '47': 'Construction & Extraction',
  '49': 'Installation, Maintenance & Repair',
  '51': 'Production',
  '53': 'Transportation & Material Moving',
}

// Explanation for why certain O*NET groups score higher/lower for second-chance hiring
const ONET_SCORING_RATIONALE: Record<string, string> = {
  '21': 'Community services may involve vulnerable populations with background requirements',
  '23': 'Legal professions are heavily regulated with character and fitness requirements',
  '25': 'Education roles working with children often have strict background check requirements',
  '29': 'Healthcare practitioners require licensing which may have felony restrictions',
  '31': 'Healthcare support may have patient access restrictions',
  '33': 'Protective services typically require background checks and have legal restrictions',
  '35': 'Food service is entry-level and known for hiring second-chance candidates',
  '37': 'Building & grounds maintenance is known for hiring second-chance candidates',
  '47': 'Construction trades are known for hiring second-chance candidates',
  '49': 'Installation & repair focuses on skills and certifications over background',
  '51': 'Manufacturing/production focuses on skills over background',
  '53': 'Transportation & logistics often hire second-chance candidates',
}

function getOnetMajorGroup(onetCode: string): string {
  return onetCode.substring(0, 2)
}

function getOnetMajorGroupTitle(onetCode: string): string | undefined {
  const majorGroup = getOnetMajorGroup(onetCode)
  return ONET_MAJOR_GROUP_TITLES[majorGroup]
}

function getOnetScoringRationale(onetCode: string): string | undefined {
  const majorGroup = getOnetMajorGroup(onetCode)
  return ONET_SCORING_RATIONALE[majorGroup]
}

interface SecondChanceAuditDetailsProps {
  typesenseId: string
}

export function SecondChanceAuditDetails({ typesenseId }: SecondChanceAuditDetailsProps) {
  const audit = useQuery(api.scrapedJobs.getSecondChanceAudit, { typesenseId })

  if (audit === undefined) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-gray-500'>Loading audit details...</div>
      </div>
    )
  }

  if (audit === null) {
    return <div className='py-4 text-center text-gray-500'>Job not found in Convex database</div>
  }

  return (
    <div className='space-y-6'>
      {/* Score Summary */}
      <div className='flex items-center gap-4'>
        <TierBadge score={audit.score} tier={audit.tier} />
        {audit.confidence !== undefined && (
          <div className='text-sm text-gray-500'>
            Confidence: {(audit.confidence * 100).toFixed(0)}%
          </div>
        )}
        {audit.scoredAt && (
          <div className='text-sm text-gray-400'>
            Scored: {new Date(audit.scoredAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Signal Contributions */}
      {audit.debug && (
        <section className='space-y-2'>
          <h4 className='font-medium text-sm text-gray-700'>Signal Contributions</h4>
          <div className='space-y-1'>
            <ContributionBar
              color='bg-blue-500'
              label='LLM Analysis'
              value={audit.debug.llmContribution}
            />
            <ContributionBar
              color='bg-green-500'
              label='Employer Match'
              value={audit.debug.employerContribution}
            />
            <ContributionBar
              color='bg-purple-500'
              label='O*NET'
              value={audit.debug.onetContribution}
            />
          </div>
          {audit.debug.overrideApplied && (
            <div className='mt-2 text-sm bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-yellow-800'>
              Override applied: {audit.debug.overrideApplied}
            </div>
          )}
        </section>
      )}

      {/* LLM Analysis */}
      <section className='space-y-2'>
        <h4 className='font-medium text-sm text-gray-700'>LLM Analysis</h4>
        <div className='bg-gray-50 rounded-lg p-3 space-y-2'>
          {audit.llmStance && (
            <div className='flex items-center gap-2'>
              <span className='text-sm text-gray-500'>Stance:</span>
              <StanceBadge stance={audit.llmStance} />
            </div>
          )}
          {audit.llmReasoning && <p className='text-sm text-gray-700'>{audit.llmReasoning}</p>}
          {!audit.llmStance && !audit.llmReasoning && (
            <p className='text-sm text-gray-400 italic'>No LLM analysis available</p>
          )}
        </div>
      </section>

      {/* Employer Lookup */}
      <section className='space-y-2'>
        <h4 className='font-medium text-sm text-gray-700'>Employer Lookup</h4>
        <div className='bg-gray-50 rounded-lg p-3'>
          {audit.employerMatch ? (
            <div className='space-y-1 text-sm'>
              <div className='flex items-center gap-2'>
                <span className='text-gray-500'>Match Type:</span>
                <span
                  className={
                    audit.employerMatch.matchType === 'exact'
                      ? 'text-green-600 font-medium'
                      : audit.employerMatch.matchType === 'fuzzy'
                        ? 'text-yellow-600'
                        : 'text-gray-400'
                  }
                >
                  {audit.employerMatch.matchType}
                </span>
              </div>
              {audit.employerMatch.matchedName && (
                <div className='flex items-center gap-2'>
                  <span className='text-gray-500'>Matched Name:</span>
                  <span className='text-gray-700'>{audit.employerMatch.matchedName}</span>
                </div>
              )}
              {audit.employerMatch.similarity !== undefined && (
                <div className='flex items-center gap-2'>
                  <span className='text-gray-500'>Similarity:</span>
                  <span className='text-gray-700'>
                    {(audit.employerMatch.similarity * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className='text-sm text-gray-400 italic'>No employer match data</p>
          )}
        </div>
      </section>

      {/* O*NET Classification */}
      {audit.onetCode && (
        <section className='space-y-2'>
          <h4 className='font-medium text-sm text-gray-700'>O*NET Classification</h4>
          <div className='bg-gray-50 rounded-lg p-3 space-y-2'>
            <div className='flex items-center gap-2 flex-wrap'>
              <code className='text-purple-600 font-mono text-sm'>{audit.onetCode}</code>
              {getOnetMajorGroupTitle(audit.onetCode) && (
                <>
                  <span className='text-gray-400'>-</span>
                  <span className='text-gray-700 text-sm'>
                    {getOnetMajorGroupTitle(audit.onetCode)}
                  </span>
                </>
              )}
            </div>
            {getOnetScoringRationale(audit.onetCode) && (
              <p className='text-sm text-gray-500 italic'>
                {getOnetScoringRationale(audit.onetCode)}
              </p>
            )}
          </div>
        </section>
      )}

      {/* All Signals */}
      {audit.signals && audit.signals.length > 0 && (
        <section className='space-y-2'>
          <h4 className='font-medium text-sm text-gray-700'>All Signals</h4>
          <ul className='bg-gray-50 rounded-lg p-3 space-y-1'>
            {audit.signals.map((signal, i) => (
              <li className='text-sm text-gray-700 flex items-start gap-2' key={i}>
                <span className='text-gray-400'>-</span>
                {signal}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Final Reasoning */}
      {audit.reasoning && (
        <section className='space-y-2'>
          <h4 className='font-medium text-sm text-gray-700'>Final Reasoning</h4>
          <p className='text-sm text-gray-700 bg-gray-50 rounded-lg p-3'>{audit.reasoning}</p>
        </section>
      )}
    </div>
  )
}

function TierBadge({ tier, score }: { tier?: string; score?: number }) {
  const colors = {
    high: 'bg-green-100 text-green-800 border-green-200',
    low: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    medium: 'bg-green-50 text-green-700 border-green-100',
    unknown: 'bg-gray-50 text-gray-600 border-gray-200',
    unlikely: 'bg-red-50 text-red-700 border-red-200',
  }

  const colorClass = colors[tier as keyof typeof colors] || colors.unknown

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${colorClass}`}>
      <span className='font-medium capitalize'>{tier || 'unknown'}</span>
      {score !== undefined && <span className='text-sm opacity-75'>({score})</span>}
    </div>
  )
}

function StanceBadge({ stance }: { stance: string }) {
  const colors = {
    fair_chance: 'bg-green-100 text-green-800',
    likely_excludes: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-700',
  }

  const colorClass = colors[stance as keyof typeof colors] || colors.unknown
  const displayName = stance.replace(/_/g, ' ')

  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {displayName}
    </span>
  )
}

function ContributionBar({ label, value, color }: { label: string; value: number; color: string }) {
  // Value is typically 0-100 contribution points
  const percentage = Math.min(100, Math.max(0, value))

  return (
    <div className='flex items-center gap-3'>
      <div className='w-24 text-sm text-gray-600'>{label}</div>
      <div className='flex-1 h-4 bg-gray-200 rounded-full overflow-hidden'>
        <div className={`h-full ${color} transition-all`} style={{ width: `${percentage}%` }} />
      </div>
      <div className='w-10 text-right text-sm text-gray-500'>{value}</div>
    </div>
  )
}
