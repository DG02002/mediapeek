import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import HomeRoute from './route';

vi.mock('~/components/footer', () => ({
  Footer: () => <div data-testid="footer" />,
}));

vi.mock('~/components/header', () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock('~/components/media-view/trademark-notice', () => ({
  TrademarkNotice: () => <div data-testid="trademark-notice" />,
}));

describe('HomeRoute', () => {
  it('renders the GitHub repository section with official lockup assets', () => {
    const { container } = render(
      <MemoryRouter>
        <HomeRoute />
      </MemoryRouter>,
    );

    expect(screen.getByText(/browse the repository on GitHub/i)).toBeTruthy();
    expect(
      screen.getByText(/built in public, maintained on GitHub/i),
    ).toBeTruthy();
    expect(screen.getByText(/metadata engine/i)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /mediainfo\.js v0\.3\.7/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /mediainfolib v25\.10/i }),
    ).toBeTruthy();
    expect(
      container.querySelector('img[src="/badges/mediainfo.svg"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('img[src="/badges/mediainfo-light.svg"]'),
    ).toBeTruthy();

    const repositoryLink = screen.getByRole('link', {
      name: /view source code/i,
    });
    expect(repositoryLink.getAttribute('href')).toBe(
      'https://github.com/DG02002/mediapeek',
    );

    const lockup = container.querySelector(
      '[data-testid="github-brand-lockup"]',
    );
    expect(lockup).toBeTruthy();
    expect(lockup?.querySelector('svg')).toBeNull();
    expect(
      lockup?.querySelector(
        'img[src="/brand/github/GitHub_Lockup_Black_Clearspace.svg"]',
      ),
    ).toBeTruthy();
    expect(
      lockup?.querySelector(
        'img[src="/brand/github/GitHub_Lockup_White_Clearspace.svg"]',
      ),
    ).toBeTruthy();

    const previewFrame = screen.getByTitle(/mediapeek preview/i);
    expect(previewFrame.tagName).toBe('IFRAME');
    expect(previewFrame.getAttribute('src')).toBe('/preview');
  });
});
