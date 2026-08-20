import { matchBestFittingTimeLabel, sanitizeIssueContent } from '../src/estimator';

describe('Auto Time Label Estimator', () => {
  it('should scale down raw estimate using configured divisor and match 1 Hour bucket', () => {
    const label = matchBestFittingTimeLabel(15, 15);
    expect(label).toBe('Time: <1 Hour');
  });

  it('should match 15 Minutes bucket for small tasks', () => {
    const label = matchBestFittingTimeLabel(3, 15);
    expect(label).toBe('Time: <15 Minutes');
  });

  it('should match 4 Hours bucket for larger tasks', () => {
    const label = matchBestFittingTimeLabel(60, 15);
    expect(label).toBe('Time: <4 Hours');
  });

  it('should sanitize and remove pre-existing time labels to prevent bias', () => {
    const text = sanitizeIssueContent('Fix typo', 'Target Time: 15 mins\nTime: <15 Minutes\nPlease fix typo');
    expect(text).not.toContain('Time: <15 Minutes');
    expect(text).toContain('Please fix typo');
  });
});
