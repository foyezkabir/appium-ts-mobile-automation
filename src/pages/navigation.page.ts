import { BasePage } from './base.page';
import { d, bringAppToFront, isAppUnderTestFrontmost } from '../support/driver';
import { NAV_A11Y } from '../locators/nav.locators';
import { TIMEOUTS } from '../support/config';

// The bottom navigation — a SHARED surface, so it is its own page object rather than a method on each module page.
export class NavigationPage extends BasePage {
  private get homeTab() {
    return this.byA11y(NAV_A11Y.home);
  }

  private get dismissScrim() {
    return this.byA11y('Dismiss');
  }

  // Is a bottom-nav tab on screen?
  async isNavVisible(): Promise<boolean> {
    return this.isVisible(this.homeTab);
  }

  // Back out to a tab route, whatever the app is currently showing.
  async goHome() {
    if (!(await isAppUnderTestFrontmost())) await bringAppToFront();
    await this.hideKeyboard();
    await this.dismissStrandedSheet();

    await d().waitUntil(
      async () => {
        if (await this.isNavVisible()) return true;
        await this.goBack();
        return this.isNavVisible();
      },
      {
        timeout: TIMEOUTS.content,
        interval: TIMEOUTS.interval,
        timeoutMsg:
          'Could not reach a tab route: the bottom nav never reappeared after repeated back presses. ' +
          'A modal sheet is probably stranded, or the app is on a route that traps back.',
      },
    );

    await this.tap(this.homeTab, 'Home tab');
  }

  // Close a modal sheet if one is open, via its scrim.
  async dismissStrandedSheet() {
    if (!(await this.isVisible(this.dismissScrim))) return;

    // The filter sheet ignores a scrim tap; its own Reset applies and closes
    // it. Try that first, then the scrim, then back — whichever the open sheet
    // responds to. Never throws: this is recovery, not an assertion.
    let reset = this.byA11y('Reset');
    if (await this.isVisible(reset)) {
      await reset.click();
    } else {
      await this.dismissScrim.click();
    }

    if (await this.isVisible(this.dismissScrim)) {
      await this.goBack();
    }
  }

  // Open a tab by its accessibility id.
  async openTab(tab: (typeof NAV_A11Y)[keyof typeof NAV_A11Y]) {
    if (!(await this.isNavVisible())) {
      await this.goHome();
    }
    await this.tap(this.byA11y(tab), `${tab} tab`);
  }

  async expectNavIsVisible() {
    await this.waitVisible(this.homeTab, 'bottom navigation');
  }
}
