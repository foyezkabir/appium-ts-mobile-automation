import type { ChainablePromiseElement } from 'webdriverio';
import { StepRecorder } from 'testreportium';
import { d, typeOnDeviceKeyboard, pressDeviceEnter } from '../support/driver';
import { TIMEOUTS, isAndroid, APP_ID } from '../support/config';

function decodeXmlEntities(xml: string): string {
  return xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    // &amp; LAST, so "&amp;lt;" does not become "<".
    .replace(/&amp;/g, '&');
}

export abstract class BasePage {
  // ------------------------------------------------------------- locators

    protected byA11y(name: string): ChainablePromiseElement {
    return d().$(`~${name}`);
  }

  // EVERY element whose accessibility id starts with `prefix`, in tree order.
  // Needed wherever sibling rows share one id — byA11y returns only the first
  // match, so tapping by name can never reach the second row.
  protected allByA11yPrefix(prefix: string) {
    if (isAndroid()) {
      return d().$$(
        `android=new UiSelector().descriptionStartsWith(${JSON.stringify(prefix)})`,
      );
    }
    return d().$$(`-ios predicate string:name BEGINSWITH ${JSON.stringify(prefix)}`);
  }

  // First element whose a11y id STARTS with `prefix` — for ids that embed live
  // data, e.g. "Book follow-up, Pre-fills with <doctor>".
  protected byA11yPrefix(prefix: string): ChainablePromiseElement {
    if (isAndroid()) return d().$(`android=new UiSelector().descriptionStartsWith(${JSON.stringify(prefix)})`);
    return d().$(`-ios predicate string:name BEGINSWITH ${JSON.stringify(prefix)}`);
  }

  // Scroll the container until an element whose a11y id starts with `prefix` is on screen.
  async scrollToA11yPrefix(prefix: string) {
    if (isAndroid()) {
      await d().$(
        `android=new UiScrollable(new UiSelector().scrollable(true))` +
          `.scrollIntoView(new UiSelector().descriptionStartsWith(${JSON.stringify(prefix)}))`,
      );
      return;
    }
    await d().execute('mobile: scroll', { predicateString: `name BEGINSWITH "${prefix}"`, direction: 'down' });
  }

  // Every element with this exact text, in tree order — for rows sharing one stamp.
  protected allByText(text: string) {
    if (isAndroid()) return d().$$(`android=new UiSelector().text(${JSON.stringify(text)})`);
    return d().$$(`-ios predicate string:label == ${JSON.stringify(text)}`);
  }

    protected byText(text: string): ChainablePromiseElement {
    if (isAndroid()) {
      return d().$(`android=new UiSelector().text(${JSON.stringify(text)})`);
    }
    return d().$(`-ios predicate string:label == ${JSON.stringify(text)}`);
  }

    protected byTextContains(fragment: string): ChainablePromiseElement {
    if (isAndroid()) {
      return d().$(
        `android=new UiSelector().textContains(${JSON.stringify(fragment)})`,
      );
    }
    return d().$(`-ios predicate string:label CONTAINS ${JSON.stringify(fragment)}`);
  }

    protected byId(id: string): ChainablePromiseElement {
    if (isAndroid()) {
      return d().$(`android=new UiSelector().resourceId(${JSON.stringify(id)})`);
    }
    return d().$(`-ios predicate string:name == ${JSON.stringify(id)}`);
  }

  // The nth EDITABLE text field below a label. Clickable only: a screen still
  // mounted underneath (My Profile under Edit Profile) has read-only copies.
  protected fieldBelow(label: string, nth = 1): ChainablePromiseElement {
    if (isAndroid()) {
      return d().$(`(//*[@text=${JSON.stringify(label)}]/following::android.widget.EditText[@clickable="true"])[${nth}]`);
    }
    // [ios] NOT device-verified.
    return d().$(`(//*[@label=${JSON.stringify(label)}]/following::XCUIElementTypeTextField)[${nth}]`);
  }

  // The first editable field whose text matches a regex — for a masked field
  // whose text changes as it is typed into (a date, a phone).
  protected fieldMatching(pattern: string): ChainablePromiseElement {
    if (isAndroid()) {
      return d().$(`android=new UiSelector().className("android.widget.EditText").clickable(true).textMatches(${JSON.stringify(pattern)})`);
    }
    return d().$(`-ios predicate string:type == "XCUIElementTypeTextField" AND value MATCHES ${JSON.stringify(pattern)}`);
  }

  // A text field by its exact text, editable or not — for asserting a LOCKED one.
  protected fieldWithText(text: string): ChainablePromiseElement {
    if (isAndroid()) return d().$(`android=new UiSelector().className("android.widget.EditText").text(${JSON.stringify(text)})`);
    return d().$(`-ios predicate string:type == "XCUIElementTypeTextField" AND value == ${JSON.stringify(text)}`);
  }

  protected focusedField(): ChainablePromiseElement {
    if (isAndroid()) return d().$('android=new UiSelector().className("android.widget.EditText").focused(true)');
    return d().$('-ios predicate string:hasKeyboardFocus == 1');
  }

  // Tap a field, then type into whatever took focus. Some RN fields re-render on
  // focus (the DOB clears itself), so the handle from before the tap is stale.
  async replaceIn(field: ChainablePromiseElement, value: string, description: string) {
    await this.tap(field, description);
    await StepRecorder.step(`type into ${description}`, () => this.focusedField().setValue(value));
  }

  // As replaceIn, but for a MASKED field (date, phone): setValue is refused
  // there, while typing into the focused field is accepted (2026-09-25).
  async typeInto(field: ChainablePromiseElement, value: string, description: string) {
    await this.tap(field, description);
    await StepRecorder.step(`type into ${description}`, () => this.focusedField().addValue(value));
  }

  // The nth editable field ABOVE a text — for a box whose only stable anchor
  // sits below it (the Others box, above its "Enter ⏎" hint).
  protected fieldAbove(text: string, nth = 1): ChainablePromiseElement {
    if (isAndroid()) return d().$(`(//*[@text=${JSON.stringify(text)}]/preceding::android.widget.EditText[@clickable="true"])[last()${nth > 1 ? `-${nth - 1}` : ''}]`);
    return d().$(`(//*[@label=${JSON.stringify(text)}]/preceding::XCUIElementTypeTextField)[last()]`);
  }

  // Tap a field, type on the device keyboard, press its Enter — for a field
  // that commits only on a real Enter.
  async typeAndSubmit(field: ChainablePromiseElement, text: string, description: string) {
    await this.tap(field, description);
    await StepRecorder.step(`type and submit ${description}`, async () => {
      typeOnDeviceKeyboard(text);
      pressDeviceEnter();
    });
  }

  // The app's number pad has its own Done key; hideKeyboard() does not close it,
  // and while it is up it covers the footer.
  async closeKeypad(done: ChainablePromiseElement) {
    if (await this.isVisible(done)) {
      await done.click();
      return;
    }
    await this.hideKeyboard();
  }

  // Scroll a text into view AND into the upper part of the screen. scrollToText
  // stops with it at the bottom edge, where a sticky footer covers what follows.
  async scrollTextHigh(text: string) {
    await this.scrollToText(text);
    let element = this.byText(text);
    if (!(await this.isVisible(element))) return;
    let { height } = await d().getWindowSize();
    if ((await element.getLocation()).y > height * 0.55) await this.scrollListBy(0.3);
  }

  // Rung 5 — the POSITIONAL EXCEPTION, documented at every call site.
  protected editTextAt(index: number): ChainablePromiseElement {
    if (isAndroid()) {
      return d().$(
        `android=new UiSelector().className("android.widget.EditText").instance(${index})`,
      );
    }
    return d().$(`-ios class chain:**/XCUIElementTypeTextField[${index + 1}]`);
  }

  // ---------------------------------------------------------------- waits

  async waitVisible(
    element: ChainablePromiseElement,
    description: string,
  ) {
    await element.waitForDisplayed({
      timeout: TIMEOUTS.visible,
      timeoutMsg: `${description} was not displayed within ${TIMEOUTS.visible}ms.`,
    });
  }

  async waitGone(
    element: ChainablePromiseElement,
    description: string,
  ) {
    await element.waitForDisplayed({
      timeout: TIMEOUTS.gone,
      reverse: true,
      timeoutMsg: `${description} was still displayed after ${TIMEOUTS.gone}ms.`,
    });
  }

    async isVisible(element: ChainablePromiseElement): Promise<boolean> {
    return element.isDisplayed().catch(() => false);
  }

    protected async decodedPageSource(): Promise<string> {
    return decodeXmlEntities(await d().getPageSource());
  }

    async waitForText(text: string) {
    await d().waitUntil(
      async () => (await this.decodedPageSource()).includes(text),
      {
        timeout: TIMEOUTS.content,
        interval: TIMEOUTS.interval,
        timeoutMsg: `Text "${text}" did not appear within ${TIMEOUTS.content}ms.`,
      },
    );
  }

  // -------------------------------------------------------------- actions
  //
  // Each action is one StepRecorder step, so the report shows a timed step
  // timeline per test. The step's first word sets its colour there (tap/type/
  // fill/read/back/restart). Recording never changes behaviour: the result is
  // returned and a throw is re-thrown. Composite actions (replaceIn, typeInto)
  // record their own tap plus the typing, never one step nested in another.

  async tap(element: ChainablePromiseElement, description: string) {
    await StepRecorder.step(`tap ${description}`, async () => {
      await this.waitVisible(element, description);
      await element.click();
    });
  }

  async fill(
    element: ChainablePromiseElement,
    value: string,
    description: string,
  ) {
    await StepRecorder.step(`fill ${description}`, async () => {
      await this.waitVisible(element, description);
      await element.click();
      await element.setValue(value); // replaces, so no clear and no re-write
    });
  }

    async hideKeyboard() {
    try {
      if (await d().isKeyboardShown()) {
        await d().hideKeyboard();
      }
    } catch {
      // No keyboard up, or the platform refuses to dismiss one. Not a failure.
    }
  }

  // Uses the CONFIGURED app id, never getCurrentPackage(): a browser or a
  // transient system overlay can be foreground, and restarting THAT throws.
  async restartApp() {
    await StepRecorder.step('restart app', async () => {
      await d().terminateApp(APP_ID); // native has no page reload
      await d().activateApp(APP_ID);
    });
  }

  // Close another app the test opened (the browser a Join link launches) and
  // come back. Merely returning leaves it RUNNING behind the app, and whenever
  // the app is later closed Android brings that leftover to the front: an old
  // "Your session link is not active yet" tab flashed on every app restart
  // (device event log, 2026-09-25).
  async closeAndReturnToApp(otherAppId: string) {
    await d().terminateApp(otherAppId);
    await this.returnToApp();
  }

  // Uses the CONFIGURED app id, never getCurrentPackage() — the caller is in
  // another app, so the foreground package is the thing being left.
  async returnToApp() {
    await d().activateApp(APP_ID);
    await d().waitUntil(async () => (await d().getCurrentPackage()) === APP_ID, {
      timeout: TIMEOUTS.visible,
      interval: TIMEOUTS.interval,
      timeoutMsg: `The app (${APP_ID}) did not come back to the foreground.`,
    });
  }

  // Pull-to-refresh on the list container — a gesture anchored to the ELEMENT,
  // never to screen coordinates, so it cannot start on the bottom nav (#4).
  // Then waits for the list to settle: two identical reads in a row.
  async pullToRefresh() {
    let list = d().$(isAndroid() ? 'android=new UiSelector().scrollable(true)' : '-ios class chain:**/XCUIElementTypeScrollView');
    await list.waitForExist({ timeout: TIMEOUTS.visible });
    if (isAndroid()) {
      await d().execute('mobile: swipeGesture', { elementId: await list.elementId, direction: 'down', percent: 0.75, speed: 1500 });
    } else {
      // [ios] NOT device-verified.
      await d().execute('mobile: swipe', { elementId: await list.elementId, direction: 'down' });
    }
    let last = '';
    await d().waitUntil(
      async () => {
        let now = await d().getPageSource();
        let settled = now === last;
        last = now;
        return settled;
      },
      { timeout: TIMEOUTS.content, interval: 700, timeoutMsg: 'The list did not settle after pull-to-refresh.' },
    );
  }

  // Scroll the list container by part of its own height — anchored to the
  // ELEMENT, not the screen, so it cannot start on the bottom nav (#4).
  async scrollListBy(percent: number) {
    let list = d().$(isAndroid() ? 'android=new UiSelector().scrollable(true)' : '-ios class chain:**/XCUIElementTypeScrollView');
    await list.waitForExist({ timeout: TIMEOUTS.visible });
    if (isAndroid()) {
      await d().execute('mobile: scrollGesture', { elementId: await list.elementId, direction: 'down', percent });
      return;
    }
    // [ios] NOT device-verified.
    await d().execute('mobile: scroll', { elementId: await list.elementId, direction: 'down' });
  }

  // Scrolls the horizontal chip row (its own scroll container, never the screen) until
  // `target` is on screen: forward first, then back to the start. A row of chips grows
  // with whatever doctors exist, so a chip can sit off-screen.
  async scrollChipRowTo(target: ChainablePromiseElement) {
    if (await target.isDisplayed()) return;
    let row = d().$(isAndroid() ? 'android=new UiSelector().className("android.widget.HorizontalScrollView")' : '-ios class chain:**/XCUIElementTypeScrollView');
    await row.waitForExist({ timeout: TIMEOUTS.visible });
    let elementId = await row.elementId;
    for (let direction of ['right', 'left']) {
      for (let step = 0; step < 15; step += 1) {
        let more: unknown = true;
        if (isAndroid()) more = await d().execute('mobile: scrollGesture', { elementId, direction, percent: 0.8 });
        else await d().execute('mobile: swipe', { elementId, direction: direction === 'right' ? 'left' : 'right' }); // [ios] NOT device-verified.
        if (await target.isDisplayed()) return;
        if (more === false) break;
      }
    }
  }

  async goBack() {
    await StepRecorder.step('back', () => this.navigateBack());
  }

  private async navigateBack() {
    if (isAndroid()) {
      await d().back();
      return;
    }
    // [ios] NOT device-verified — no iOS target has been run against this suite.
    let navBack = d().$('-ios predicate string:type == "XCUIElementTypeButton" AND name == "Back"');
    if (await this.isVisible(navBack)) {
      await navBack.click();
      return;
    }
    throw new Error(
      'goBack() on iOS found no navigation-bar Back control. ' +
        'The screen may use a Cancel/X affordance — handle it in the page object.',
    );
  }

  // ------------------------------------------------------------ scrolling

  // Drive the SCROLL CONTAINER — never a coordinate swipe (zero tolerance #4).
  async scrollToText(text: string) {
    await this.hideKeyboard();
    if (isAndroid()) {
      await d().$(
        `android=new UiScrollable(new UiSelector().scrollable(true))` +
          `.scrollIntoView(new UiSelector().text(${JSON.stringify(text)}))`,
      );
      return;
    }
    await d().execute('mobile: scroll', { predicateString: `label == "${text}"`, direction: 'down' });
  }

  // Use this before TAPPING or TYPING into anything (zero tolerance #5).
  async scrollFieldIntoReach(text: string) {
    await this.scrollToText(text);

    let element = this.byText(text);
    if (!(await this.isVisible(element))) return;

    let { height } = await d().getWindowSize();
    let location = await element.getLocation();
    let size = await element.getSize();
    let bottomOfElement = Number(location.y) + Number(size.height);

    // Treat the lowest ~12% of the viewport as nav-occluded. Measured on the
    // Pixel 7 Pro (2992px tall, nav band begins ~2640px) — re-measure rather
    // than assume if a device with a different nav height is introduced.
    let safeBottom = height * 0.88;
    if (bottomOfElement <= safeBottom) return;

    await this.scrollDown();
  }

  // One container-driven scroll step.
  async scrollDown() {
    if (isAndroid()) {
      try {
        await d().$(
          `android=new UiScrollable(new UiSelector().scrollable(true)).scrollForward()`,
        );
      } catch {
        // Already at the end of the list. Not a failure.
      }
      return;
    }
    await d().execute('mobile: swipe', { direction: 'up' });
  }

  async scrollToTop() {
    if (isAndroid()) {
      try {
        await d().$(
          `android=new UiScrollable(new UiSelector().scrollable(true)).flingToBeginning(10)`,
        );
      } catch {
        // Nothing scrollable on screen. Not a failure.
      }
      return;
    }
    await d().execute('mobile: scroll', { direction: 'up' });
  }

  // -------------------------------------------------------------- reading

  async textOf(element: ChainablePromiseElement, description: string): Promise<string> {
    return StepRecorder.step(`read ${description}`, async () => {
      await this.waitVisible(element, description);
      return element.getText();
    });
  }

  // Every visible text node on screen.
  async visibleTexts(): Promise<string[]> {
    let source = await this.decodedPageSource();
    let attribute = isAndroid() ? 'text' : 'label';
    let matches = source.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'));
    return [...matches].map((m) => m[1]).filter((t) => t.trim() !== '');
  }

  // Every text node INSIDE one element, in tree order — for a card whose
  // children carry its fields. [android] verified 2026-09-29; [ios] UNVERIFIED.
  async textsWithin(element: ChainablePromiseElement): Promise<string[]> {
    let children = isAndroid()
      ? await element.$$('android=new UiSelector().className("android.widget.TextView")')
      : await element.$$('-ios class chain:**/XCUIElementTypeStaticText');
    let texts: string[] = [];
    for (let child of children) texts.push(await child.getText());
    return texts;
  }

  // Every accessibility name on screen.
  async a11yNames(): Promise<string[]> {
    let source = await this.decodedPageSource();
    let attribute = isAndroid() ? 'content-desc' : 'name';
    let matches = source.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'));
    return [...matches].map((m) => m[1]).filter((t) => t.trim() !== '');
  }
}
