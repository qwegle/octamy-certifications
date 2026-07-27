import * as WebBrowser from 'expo-web-browser';

import { openCashfreeCheckout } from '@/lib/cashfree-checkout.native';

describe('Cashfree hosted checkout bridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (WebBrowser.openBrowserAsync as jest.Mock).mockResolvedValue({ type: 'opened' });
  });

  it('uses the approved Octamy origin and never places the session in the query string', async () => {
    await expect(openCashfreeCheckout({ paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyz123456' }))
      .resolves.toEqual({ type: 'opened' });

    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledTimes(1);
    const rawUrl = (WebBrowser.openBrowserAsync as jest.Mock).mock.calls[0]?.[0] as string;
    const url = new URL(rawUrl);
    expect(url.origin).toBe('https://octamy.com');
    expect(url.pathname).toBe('/payment/cashfree/checkout/');
    expect(url.search).toBe('');
    const fragment = new URLSearchParams(url.hash.slice(1));
    expect(fragment.get('mode')).toBe('production');
    expect(fragment.get('payment_session_id')).toBe('session_abcdefghijklmnopqrstuvwxyz123456');
  });

  it('uses a validated provider link when the server supplies one', async () => {
    await openCashfreeCheckout({
      paymentLink: 'https://payments.cashfree.com/example',
      paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyz123456',
    });
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://payments.cashfree.com/example');
  });

  it('rejects untrusted provider links instead of navigating to attacker-controlled content', async () => {
    await expect(openCashfreeCheckout({
      paymentLink: 'https://cashfree.example.test/phishing',
      paymentSessionId: 'session_abcdefghijklmnopqrstuvwxyz123456',
    })).rejects.toMatchObject({ code: 'PAYMENT_LINK_UNTRUSTED' });
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('rejects malformed payment sessions even when a payment link is supplied', async () => {
    await expect(openCashfreeCheckout({
      paymentLink: 'https://payments.cashfree.com/example',
      paymentSessionId: 'not-a-session',
    })).rejects.toMatchObject({ code: 'PAYMENT_SESSION_INVALID' });
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });
});
