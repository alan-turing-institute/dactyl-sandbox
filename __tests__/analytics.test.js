const {
  ALLOWED_EVENTS,
  createAnalytics,
  sanitizeAnalyticsEvent,
  sanitizeAnalyticsPayload,
} = require('../analytics');

describe('privacy-preserving analytics', () => {
  test('allows only expected event names', () => {
    expect(ALLOWED_EVENTS).toEqual(expect.arrayContaining([
      'signup',
      'login',
      'task_created',
      'task_completed',
      'focus_started',
      'focus_completed',
      'tour_opened',
      'export_created',
    ]));
    expect(sanitizeAnalyticsEvent('task_created', { priority: 'high' })).toEqual({
      event: 'task_created',
      payload: { priority: 'high' },
    });
    expect(sanitizeAnalyticsEvent('task_title_leaked', { taskText: 'secret' })).toBeNull();
  });

  test('redacts sensitive keys and unsafe string values from payloads', () => {
    expect(sanitizeAnalyticsPayload({
      priority: 'high',
      taskCount: 3,
      hasDueDate: true,
      taskText: 'Call Alice about budget',
      username: 'share-owner',
      email: 'person@example.com',
      githubUrl: 'https://github.com/alan-turing-institute/dactyl-sandbox/issues/81',
      freeform: 'contains spaces and therefore looks like text',
      nested: { text: 'hidden' },
    })).toEqual({
      priority: 'high',
      taskCount: 3,
      hasDueDate: true,
    });
  });

  test('disabled analytics sanitises but does not send', async () => {
    const fetchImpl = jest.fn();
    const analytics = createAnalytics({ enabled: false, fetchImpl });

    await expect(analytics.track('task_completed', { taskText: 'private', priority: 'low' })).resolves.toEqual({
      sent: false,
      reason: 'disabled',
      event: { event: 'task_completed', payload: { priority: 'low' } },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('enabled analytics sends only sanitised payloads', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const analytics = createAnalytics({ enabled: true, endpoint: '/collect', fetchImpl });

    await expect(analytics.track('export_created', { taskCount: 4, title: 'Private pond' })).resolves.toMatchObject({ sent: true });
    expect(fetchImpl).toHaveBeenCalledWith('/collect', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ event: 'export_created', payload: { taskCount: 4 } }),
    }));
  });
});
