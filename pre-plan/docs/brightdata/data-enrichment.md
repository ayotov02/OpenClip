> ## Documentation Index
> Fetch the complete documentation index at: https://docs.brightdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Data Enrichment

> Build AI agents that automatically fill CRM data, enrich leads, and complete customer records at enterprise scale. Master the search-and-extract pattern for enrichment operations.

<Card title="Building an AI startup?" cta="Learn more" href="https://brightdata.com/ai/ai-startups-program" icon="rocket-launch" iconType="duotone" arrow="true">
  You might be eligible for our Startup Program. Get fully funded access to the infrastructure you're reading about right now (up to \$20K value).
</Card>

# Data Enrichment

Build AI agents that automatically fill CRM data, enrich leads, and complete customer records at enterprise scale.

Master the search-and-extract pattern for enrichment operations, from LinkedIn company data collection to lead scoring workflows.

<CardGroup cols={2}>
  <Card title="Learn the Pattern" icon="lightbulb" href="#the-enrichment-pattern">
    Understand the enrichment workflow
  </Card>

  <Card title="Get Started" icon="rocket" href="#contact-enrichment---linkedin-example">
    Start with a LinkedIn example
  </Card>
</CardGroup>

***

## Complexity Handling

Address common challenges in enrichment systems:

* **LinkedIn's aggressive anti-bot measures** - Automatically bypass with Web Unlocker
* **CAPTCHA challenges** - Automatic CAPTCHA solving with no manual intervention
* **Rate limiting** - Intelligent rate management and proxy rotation
* **Data quality issues** - Built-in validation and error handling

Bright Data's infrastructure solves these with automatic CAPTCHA solving, intelligent rate management, and production-ready reliability.

<CardGroup cols={2}>
  <Card title="Automatic CAPTCHA Solving" icon="unlock" href="/scraping-automation/web-unlocker/introduction">
    Never get blocked by CAPTCHAs or bot detection
  </Card>

  <Card title="Rate Management" icon="clock" href="/proxy-networks/residential/configure-your-proxy">
    Intelligent rate limiting and proxy rotation
  </Card>

  <Card title="Data Validation" icon="check-circle" href="/datasets/data-validation/data-validation-for-customers">
    Built-in validation ensures data quality
  </Card>

  <Card title="Error Handling" icon="exclamation-triangle" href="/proxy-networks/errorCatalog">
    Robust error handling for production reliability
  </Card>
</CardGroup>

***

## Scalability

Scale from enriching hundreds of leads to processing millions of records with the same infrastructure.

Built for enrichment patterns like:

* **Parallel processing** for throughput
* **Error handling** for reliability
* **Data validation** for quality

<CardGroup cols={3}>
  <Card title="Parallel Processing" icon="server">
    Process thousands of leads simultaneously with enterprise-scale infrastructure
  </Card>

  <Card title="Error Handling" icon="shield-check">
    Robust error handling ensures reliability at scale
  </Card>

  <Card title="Data Validation" icon="check-circle">
    Built-in validation ensures high-quality enriched data
  </Card>
</CardGroup>

***

## The Enrichment Pattern

The enrichment pattern typically follows these steps:

1. **Input** - Receive a list of leads or records that need enrichment
2. **Search** - Search for each lead using SERP API or web scraping
3. **Extract** - Extract relevant data from search results
4. **Validate** - Validate the extracted data for quality
5. **Enrich** - Add the enriched data to your CRM or database
6. **Monitor** - Monitor success rates and data quality

<Steps>
  <Step title="Prepare Input Data">
    Prepare your list of leads or records that need enrichment. Include identifiers like company names, domains, or email addresses.

    ```json  theme={null}
    [
      {
        "company_name": "Example Corp",
        "domain": "example.com",
        "email": "contact@example.com"
      }
    ]
    ```
  </Step>

  <Step title="Search for Data">
    Use SERP API or web scraping to search for each lead and find relevant information.

    <CodeGroup>
      ```javascript Node.js theme={null}
      const response = await fetch('https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_DATASET_ID', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          url: 'https://www.google.com/search',
          keyword: 'Example Corp company information',
          country: 'US'
        }])
      });
      ```

      ```python Python theme={null}
      import requests

      response = requests.post(
        'https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_DATASET_ID',
        headers={
          'Authorization': f'Bearer {api_key}',
          'Content-Type': 'application/json'
        },
        json=[{
          'url': 'https://www.google.com/search',
          'keyword': 'Example Corp company information',
          'country': 'US'
        }]
      )
      ```
    </CodeGroup>
  </Step>

  <Step title="Extract and Validate">
    Extract relevant data from search results and validate for quality.

    <Tip>
      Use data validation endpoints to ensure the extracted data meets your quality standards.
    </Tip>
  </Step>

  <Step title="Enrich Records">
    Add the enriched data to your CRM or database.

    <Check>
      Successfully enriched leads are saved with complete contact information.
    </Check>
  </Step>
</Steps>

***

## Contact Enrichment - LinkedIn Example

Enrich leads with LinkedIn company data:

### Step 1: Search LinkedIn

Search for company information on LinkedIn:

<CodeGroup>
  ```javascript Node.js theme={null}
  const response = await fetch('https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_LINKEDIN_DATASET_ID', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{
      url: 'https://www.linkedin.com/company/example-corp',
      company_name: 'Example Corp'
    }])
  });
  ```

  ```python Python theme={null}
  import requests

  response = requests.post(
    'https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_LINKEDIN_DATASET_ID',
    headers={
      'Authorization': f'Bearer {api_key}',
      'Content-Type': 'application/json'
    },
    json=[{
      'url': 'https://www.linkedin.com/company/example-corp',
      'company_name': 'Example Corp'
    }]
  )
  ```
</CodeGroup>

### Step 2: Extract Company Data

Extract company information:

```json  theme={null}
{
  "company_name": "Example Corp",
  "industry": "Technology",
  "employee_count": "1000-5000",
  "location": "San Francisco, CA",
  "website": "https://example.com",
  "description": "Leading technology company..."
}
```

### Step 3: Enrich Your CRM

Add the enriched data to your CRM:

<CodeGroup>
  ```javascript Node.js theme={null}
  // Add enriched data to your CRM
  await crm.addContact({
    company_name: enrichedData.company_name,
    industry: enrichedData.industry,
    employee_count: enrichedData.employee_count,
    location: enrichedData.location,
    website: enrichedData.website
  });
  ```

  ```python Python theme={null}
  # Add enriched data to your CRM
  crm.add_contact(
    company_name=enriched_data['company_name'],
    industry=enriched_data['industry'],
    employee_count=enriched_data['employee_count'],
    location=enriched_data['location'],
    website=enriched_data['website']
  )
  ```
</CodeGroup>

***

## Bulk Processing

Process large volumes of leads efficiently:

### Parallel Processing

Process multiple leads simultaneously:

<CodeGroup>
  ```javascript Node.js theme={null}
  const leads = [/* array of leads */];
  const enrichmentPromises = leads.map(lead => 
    enrichLead(lead)
  );

  const enrichedLeads = await Promise.all(enrichmentPromises);
  ```

  ```python Python theme={null}
  import asyncio

  leads = [/* list of leads */]

  async def enrich_lead(lead):
      # Enrichment logic
      pass

  async def enrich_all_leads():
      tasks = [enrich_lead(lead) for lead in leads]
      enriched_leads = await asyncio.gather(*tasks)
      return enriched_leads
  ```
</CodeGroup>

### Batch Processing

Process leads in batches to manage rate limits:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function processBatch(leads, batchSize = 10) {
    for (let i = 0; i < leads.length; i += batchSize) {
      const batch = leads.slice(i, i + batchSize);
      await Promise.all(batch.map(lead => enrichLead(lead)));
      // Wait between batches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  ```

  ```python Python theme={null}
  import time

  def process_batch(leads, batch_size=10):
      for i in range(0, len(leads), batch_size):
          batch = leads[i:i + batch_size]
          for lead in batch:
              enrich_lead(lead)
          # Wait between batches to respect rate limits
          time.sleep(1)
  ```
</CodeGroup>

***

## Common Data Sources

<CardGroup cols={2}>
  <Card title="LinkedIn" icon="linkedin" href="/api-reference/web-scraper-api/social-media-apis/linkedin">
    Company and professional data from LinkedIn
  </Card>

  <Card title="Google Search" icon="magnifying-glass" href="/scraping-automation/serp-api/introduction">
    Search results for company information and news
  </Card>

  <Card title="Company Websites" icon="globe" href="/scraping-automation/scraping-browser/introduction">
    Extract company information directly from websites
  </Card>

  <Card title="Social Media" icon="share" href="/api-reference/web-scraper-api/social-media-apis/overview">
    Social media profiles and engagement data
  </Card>
</CardGroup>

***

## Error Handling

Implement robust error handling for production reliability:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function enrichLeadWithRetry(lead, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await enrichLead(lead);
        return result;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }
  ```

  ```python Python theme={null}
  import time

  def enrich_lead_with_retry(lead, max_retries=3):
      for attempt in range(1, max_retries + 1):
          try:
              result = enrich_lead(lead)
              return result
          except Exception as error:
              if attempt == max_retries:
                  raise error
              # Exponential backoff
              time.sleep(2 ** attempt)
  ```
</CodeGroup>

***

## Templates

Use pre-built templates for common enrichment workflows:

<CardGroup cols={2}>
  <Card title="LinkedIn Company Enrichment" icon="linkedin" href="/api-reference/web-scraper-api/social-media-apis/linkedin">
    Template for enriching leads with LinkedIn company data
  </Card>

  <Card title="Email Validation" icon="envelope" href="/datasets/deep-lookup/overview">
    Template for validating and enriching email addresses
  </Card>

  <Card title="Contact Information" icon="address-book" href="/datasets/deep-lookup/overview">
    Template for enriching contact information
  </Card>

  <Card title="Company Intelligence" icon="building" href="/datasets/deep-lookup/overview">
    Template for collecting company intelligence data
  </Card>
</CardGroup>

***

## Next Steps

<CardGroup cols={2}>
  <Card title="SERP API Quickstart" icon="rocket" href="/search-api-quickstart">
    Start collecting search results for enrichment
  </Card>

  <Card title="LinkedIn Scrapers" icon="rocket" href="/api-reference/web-scraper-api/social-media-apis/linkedin">
    Use pre-built LinkedIn scrapers for company data
  </Card>

  <Card title="Deep Lookup" icon="rocket" href="/datasets/deep-lookup/overview">
    Use Deep Lookup for comprehensive data enrichment
  </Card>

  <Card title="Browse Examples" icon="code" href="/datasets/scrapers/scrapers-library">
    Explore pre-built scrapers for common data sources
  </Card>
</CardGroup>

<Info>
  **Need help?** Check out our [Data Validation Guide](/datasets/data-validation/data-validation-for-customers) or [contact support](https://brightdata.com/contact).
</Info>