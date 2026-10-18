import { render, screen } from "@testing-library/react"
import React from "react"
import { MemoryRouter } from "react-router"
import { ThemeProvider } from "remix-themes"
import { describe, expect, it } from "vitest"

import HomeRoute from "./route"

describe("HomeRoute", () => {
  it("renders the GitHub repository section with official lockup assets", () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider specifiedTheme={null} themeAction="/action/set-theme">
          <HomeRoute />
        </ThemeProvider>
      </MemoryRouter>
    )

    expect(screen.getByText(/browse the repository on GitHub/i)).toBeTruthy()
    expect(
      screen.getByText(/built in public, maintained on GitHub/i)
    ).toBeTruthy()
    expect(screen.getByText(/metadata engine/i)).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /mediainfo\.js v0\.3\.8/i })
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /mediainfolib v25\.10/i })
    ).toBeTruthy()
    expect(
      container.querySelector('img[src="/badges/mediainfo.svg"]')
    ).toBeTruthy()
    expect(
      container.querySelector('img[src="/badges/mediainfo-light.svg"]')
    ).toBeTruthy()

    const repositoryLink = screen.getByRole("link", {
      name: /view source code/i,
    })

    expect(repositoryLink.getAttribute("href")).toBe(
      "https://github.com/DG02002/mediapeek"
    )

    const lockup = container.querySelector(
      '[data-testid="github-brand-lockup"]'
    )

    expect(lockup).toBeTruthy()
    expect(lockup?.querySelector("svg")).toBeNull()
    expect(
      lockup?.querySelector(
        'img[src="/brand/github/GitHub_Lockup_Black_Clearspace.svg"]'
      )
    ).toBeTruthy()
    expect(
      lockup?.querySelector(
        'img[src="/brand/github/GitHub_Lockup_White_Clearspace.svg"]'
      )
    ).toBeTruthy()

    const previewFrame = screen.getByTitle(/mediapeek preview/i)
    expect(previewFrame.tagName).toBe("IFRAME")
    expect(previewFrame.getAttribute("src")).toBe("/preview")
  })
})
