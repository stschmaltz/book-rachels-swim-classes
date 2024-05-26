import puppeteer, { Page } from "puppeteer";
import cheerio from "cheerio";

interface ClassDetails {
  className: string;
  date?: string;
  time?: string;
  spaces: number;
  bookNowSelector: string;
}

interface ClassCriteria {
  className: string;
  days: string[];
  time: string;
}

const url =
  "https://liveandplay.calgary.ca/REGPROG/public/category/browse/KillarneyDropin";

const classCriteria: ClassCriteria[] = [
  {
    className: "Tethered Deep Water Workout",
    days: ["Mon", "Wed"],
    time: "7:10 PM - 7:55 PM",
  },
  // {
  //   className: "Pure Cycle",
  //   days: ["Thu"],
  //   time: "6:00 PM - 7:00 PM",
  // },
  // {
  //   className: "Balance and Strength (Gentle 2)",
  //   days: ["Thu"],
  //   time: "10:45 AM - 11:45 AM",
  // },
  {
    className: "Aqua Fitness",
    days: ["Tue", "Thu"],
    time: "8:10 AM - 9:00 AM",
  },
];

const username = "stschmaltz@gmail.com";
const password = "@EGV74BUIoXz!^Yb";

async function setupPuppeteer() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return { browser, page };
}

async function fetchClasses(page: Page): Promise<ClassDetails[]> {
  try {
    await page.waitForSelector("#_ClassTimetableGridResultsDetail");

    const content = await page.content();
    const $ = cheerio.load(content);

    const classes: ClassDetails[] = [];
    $('[id="_ClassTimetableGridResultsDetail"]').each((i, element) => {
      const className = $(element).find("p.mb-1").eq(0).text().trim();
      const infoButton = $(element).find("button").eq(0);

      const date = infoButton.attr("data-class-date");
      const time = infoButton.attr("data-class-time");

      const spacesText = $(element).find("p.mb-1.small span").text().trim();
      const spaces = parseInt(spacesText, 10);

      const bookNowSelector = $(infoButton).next("a.BookNow");

      if (!isNaN(spaces)) {
        classes.push({
          className,
          date,
          time,
          spaces,
          bookNowSelector: bookNowSelector.attr("href") || "",
        });
      }
    });

    return classes;
  } catch (error) {
    console.error("Error fetching classes:", error);
    return [];
  }
}

function filterTargetClasses(
  classes: ClassDetails[],
  criteria: ClassCriteria[]
): ClassDetails[] {
  return classes.filter((c) => {
    return criteria.some((criterion) => {
      const isClassNameMatch = c.className === criterion.className;
      const isDayMatch = criterion.days.some((day) =>
        (c.date ?? "").toLowerCase().startsWith(day.toLowerCase())
      );
      const isTimeMatch =
        (c.time ?? "").toLowerCase() === criterion.time.toLowerCase();

      return isClassNameMatch && isDayMatch && isTimeMatch;
    });
  });
}

async function clickBookNowButton(
  page: Page,
  targetClass: ClassDetails
): Promise<boolean> {
  if (targetClass.spaces > 0 && targetClass.bookNowSelector) {
    try {
      await page.goto(
        `https://liveandplay.calgary.ca${targetClass.bookNowSelector}`,
        { waitUntil: "domcontentloaded" }
      );

      console.log(
        `Clicked "Book Now" button for class: ${targetClass.className} on ${targetClass.date} at ${targetClass.time}`
      );
      return true;
    } catch (error) {
      console.error('Error clicking "Book Now" button:', error);
      return false;
    }
  } else {
    console.log(
      `Class "${targetClass.className}" on ${targetClass.date} at ${targetClass.time} is full or has no book now link.`
    );
    return false;
  }
}

async function clickCheckoutButton(page: Page) {
  try {
    await page.goto(
      "https://liveandplay.calgary.ca/REGPROG/public/Basket/CheckoutBasket",
      { waitUntil: "domcontentloaded" }
    );
    console.log('Clicked "Checkout" button.');
  } catch (error) {
    console.error('Error clicking "Checkout" button:', error);
  }
}

async function fillLoginForm(page: Page, username: string, password: string) {
  try {
    await page.waitForSelector("#LogonForm");
    await page.type("#EmailAddress", username);
    await page.type("#Password", password);
    await page.click('input[type="submit"]');
    console.log("Filled in login form and submitted.");
  } catch (error) {
    console.error("Error filling in login form:", error);
  }
}

async function waitForConfirmation(page: Page) {
  try {
    await page.waitForFunction(() =>
      document.body.innerText.includes("Order Confirmation")
    );
    console.log("Order confirmation received.");
  } catch (error) {
    console.error("Error waiting for order confirmation:", error);
  }
}

(async () => {
  const { browser, page } = await setupPuppeteer();

  const classes = await fetchClasses(page);

  const targetClasses = filterTargetClasses(classes, classCriteria);

  if (targetClasses.length > 0) {
    for (const targetClass of targetClasses) {
      console.log(
        `Class found: ${targetClass.className} on ${targetClass.date} at ${targetClass.time} with ${targetClass.spaces} spaces`
      );
      const booked = await clickBookNowButton(page, targetClass);
      if (booked) {
        console.log(`Successfully booked class: ${targetClass.className}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    await clickCheckoutButton(page);
    await fillLoginForm(page, username, password);
    await waitForConfirmation(page);
  } else {
    console.log(`No classes available for the specified criteria`);
  }

  await browser.close();
})();
