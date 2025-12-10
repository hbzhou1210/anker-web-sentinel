import { Page } from 'playwright';
import { UITestResult, UITestType, TestResultStatus } from '../models/entities.js';
import screenshotService from './ScreenshotService.js';
import failureAnalysisService from './FailureAnalysisService.js';

export class UITestingService {
  // Test all links on the page
  async testLinks(page: Page): Promise<UITestResult[]> {
    const results: UITestResult[] = [];

    try {
      // Find all links with href attribute
      const links = await page.locator('a[href]').all();
      console.log(`Found ${links.length} links to test`);

      for (const link of links) {
        try {
          const href = await link.getAttribute('href');
          const text = (await link.textContent())?.trim() || '';

          // Skip empty or anchor-only hrefs
          if (!href || href === '#' || href === 'javascript:void(0)') {
            // Capture screenshot for invalid links
            const selector = `a[href="${href || ''}"]`;
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              selector,
              'Invalid Link'
            );

            const errorMessage = 'Link has empty or anchor-only href';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Link,
              TestResultStatus.Warning,
              errorMessage,
              { href, text }
            );

            results.push({
              id: '', // Will be set by repository
              testReportId: '', // Will be set by repository
              testType: UITestType.Link,
              elementId: selector,
              status: TestResultStatus.Warning,
              errorMessage,
              diagnostics: {
                href,
                text,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Check if link contains 'beta' in the URL (subdomain or path)
          const lowerHref = href.toLowerCase();
          const hasBeta = lowerHref.includes('beta.') || lowerHref.includes('/beta/') || lowerHref.includes('/beta');

          if (hasBeta) {
            // Capture screenshot for beta link
            const selector = `a[href="${href}"]`;
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              selector,
              'Beta Link'
            );

            const errorMessage = 'Link contains beta URL (subdomain or path)';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Link,
              TestResultStatus.Warning,
              errorMessage,
              { href, text, hasBeta: true }
            );

            results.push({
              id: '',
              testReportId: '',
              testType: UITestType.Link,
              elementId: selector,
              status: TestResultStatus.Warning,
              errorMessage,
              diagnostics: {
                href,
                text,
                hasBeta: true,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Check if link is visible and enabled
          const isVisible = await link.isVisible();
          const isEnabled = await link.isEnabled();

          // Skip invisible links - this is normal in modern UIs (navigation menus, dropdowns, etc.)
          if (!isVisible) {
            continue;
          }

          // Keep checking for disabled links as this might indicate an issue
          if (!isEnabled) {
            // Capture screenshot for disabled links
            const selector = `a[href="${href}"]`;
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              selector,
              'Disabled Link'
            );

            const errorMessage = 'Link is disabled';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Link,
              TestResultStatus.Warning,
              errorMessage,
              { href, text, isEnabled }
            );

            results.push({
              id: '',
              testReportId: '',
              testType: UITestType.Link,
              elementId: selector,
              status: TestResultStatus.Warning,
              errorMessage: 'Link is not enabled',
              diagnostics: {
                href,
                text,
                isEnabled,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Link is valid
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Link,
            elementId: `a[href="${href}"]`,
            status: TestResultStatus.Pass,
            diagnostics: { href, text },
          });
        } catch (error) {
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Link,
            status: TestResultStatus.Fail,
            errorMessage: `Failed to test link: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    } catch (error) {
      console.error('Error testing links:', error);
      results.push({
        id: '',
        testReportId: '',
        testType: UITestType.Link,
        status: TestResultStatus.Fail,
        errorMessage: `Failed to locate links: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  // Test all forms on the page
  async testForms(page: Page): Promise<UITestResult[]> {
    const results: UITestResult[] = [];

    try {
      const forms = await page.locator('form').all();
      console.log(`Found ${forms.length} forms to test`);

      for (const form of forms) {
        try {
          const formId = await form.getAttribute('id');
          const formName = await form.getAttribute('name');
          const identifier = formId || formName || 'form';

          // Check for submit button or input[type="submit"]
          const submitButton = form.locator('button[type="submit"], input[type="submit"]');
          const submitCount = await submitButton.count();

          if (submitCount === 0) {
            // Capture screenshot for form without submit button
            const selector = formId ? `form#${formId}` : (formName ? `form[name="${formName}"]` : 'form');
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              selector,
              'No Submit Button'
            );

            const errorMessage = 'Form has no submit button';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Form,
              TestResultStatus.Fail,
              'No submit button',
              { formId, formName }
            );

            results.push({
              id: '',
              testReportId: '',
              testType: UITestType.Form,
              elementId: `form#${identifier}`,
              status: TestResultStatus.Fail,
              errorMessage,
              diagnostics: {
                formId,
                formName,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Check if form is visible
          const isVisible = await form.isVisible();

          if (!isVisible) {
            // Capture screenshot for hidden form
            const selector = formId ? `form#${formId}` : (formName ? `form[name="${formName}"]` : 'form');
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              selector,
              'Hidden Form'
            );

            const errorMessage = 'Form is hidden';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Form,
              TestResultStatus.Warning,
              errorMessage,
              { formId, formName, submitCount }
            );

            results.push({
              id: '',
              testReportId: '',
              testType: UITestType.Form,
              elementId: `form#${identifier}`,
              status: TestResultStatus.Warning,
              errorMessage: 'Form is not visible',
              diagnostics: {
                formId,
                formName,
                submitCount,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Form is valid
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Form,
            elementId: `form#${identifier}`,
            status: TestResultStatus.Pass,
            diagnostics: { formId, formName, submitCount },
          });
        } catch (error) {
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Form,
            status: TestResultStatus.Fail,
            errorMessage: `Failed to test form: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    } catch (error) {
      console.error('Error testing forms:', error);
    }

    return results;
  }

  // Test all buttons on the page
  async testButtons(page: Page): Promise<UITestResult[]> {
    const results: UITestResult[] = [];

    try {
      const buttons = await page.locator('button, input[type="button"]').all();
      console.log(`Found ${buttons.length} buttons to test`);

      for (const button of buttons) {
        try {
          const buttonText = (await button.textContent())?.trim() || '';
          const buttonId = await button.getAttribute('id');
          const identifier = buttonId || buttonText || 'button';

          // Check if button is visible
          const isVisible = await button.isVisible();
          const isEnabled = await button.isEnabled();
          const isDisabled = await button.isDisabled();

          // Skip invisible buttons - this is normal in modern UIs (dropdown menus, modals, etc.)
          if (!isVisible) {
            continue;
          }

          if (isDisabled) {
            // Capture screenshot for disabled button
            const selector = buttonId ? `button#${buttonId}` : `button:has-text("${buttonText}")`;
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              selector,
              'Disabled Button'
            );

            const errorMessage = 'Button is disabled';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Button,
              TestResultStatus.Warning,
              errorMessage,
              { buttonText, buttonId }
            );

            results.push({
              id: '',
              testReportId: '',
              testType: UITestType.Button,
              elementId: `button#${identifier}`,
              status: TestResultStatus.Warning,
              errorMessage,
              diagnostics: {
                buttonText,
                buttonId,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Button is responsive
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Button,
            elementId: `button#${identifier}`,
            status: TestResultStatus.Pass,
            diagnostics: { buttonText, buttonId, isEnabled },
          });
        } catch (error) {
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Button,
            status: TestResultStatus.Fail,
            errorMessage: `Failed to test button: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    } catch (error) {
      console.error('Error testing buttons:', error);
    }

    return results;
  }

  // Test all images on the page
  async testImages(page: Page): Promise<UITestResult[]> {
    const results: UITestResult[] = [];

    try {
      const images = await page.locator('img[src]').all();
      console.log(`Found ${images.length} images to test`);

      for (const img of images) {
        try {
          const src = await img.getAttribute('src');
          const alt = await img.getAttribute('alt');

          if (!src) {
            // Capture screenshot for image without src
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              'img',
              'No Source'
            );

            const errorMessage = 'No src attribute';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Image,
              TestResultStatus.Fail,
              errorMessage,
              { alt }
            );

            results.push({
              id: '',
              testReportId: '',
              testType: UITestType.Image,
              elementId: 'img',
              status: TestResultStatus.Fail,
              errorMessage: 'Image has no src attribute',
              diagnostics: {
                alt,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Check if image loaded successfully by checking naturalWidth
          const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);

          if (naturalWidth === 0) {
            // Capture screenshot for broken image
            const selector = `img[src="${src}"]`;
            const screenshotUrl = await screenshotService.captureWithHighlight(
              page,
              selector,
              'Broken Image'
            );

            const errorMessage = 'Failed to load';
            const analysis = failureAnalysisService.analyzeUITestFailure(
              UITestType.Image,
              TestResultStatus.Fail,
              errorMessage,
              { src, alt }
            );

            results.push({
              id: '',
              testReportId: '',
              testType: UITestType.Image,
              elementId: selector,
              status: TestResultStatus.Fail,
              errorMessage: 'Image failed to load (naturalWidth is 0)',
              diagnostics: {
                src,
                alt,
                analysis: analysis ? {
                  cause: analysis.cause,
                  recommendation: analysis.recommendation,
                  severity: analysis.severity,
                  fixComplexity: analysis.fixComplexity,
                } : undefined,
              },
              screenshotUrl: screenshotUrl || undefined,
            });
            continue;
          }

          // Image loaded successfully
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Image,
            elementId: `img[src="${src}"]`,
            status: TestResultStatus.Pass,
            diagnostics: { src, alt, naturalWidth },
          });
        } catch (error) {
          results.push({
            id: '',
            testReportId: '',
            testType: UITestType.Image,
            status: TestResultStatus.Fail,
            errorMessage: `Failed to test image: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    } catch (error) {
      console.error('Error testing images:', error);
    }

    return results;
  }
}

export default new UITestingService();
