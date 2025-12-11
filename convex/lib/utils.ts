export type Salary = {
  min?: number;
  max?: number;
  amount?: number;
  unit: 'hr' | 'day' | 'week' | 'month' | 'year';
};

export const formatSalary = (salary: Salary): string => {
  if (salary.min !== undefined && salary.max !== undefined) {
    return `$${salary.min} - $${salary.max} / ${salary.unit}`;
  }
  if (salary.amount !== undefined) {
    return `$${salary.amount} / ${salary.unit}`;
  }
  return '';
};

export const kebabToReadable = (type: string): string => {
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatMonthDay = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};
