> ## Documentation Index
> Fetch the complete documentation index at: https://docs.brightdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Agent Web Access

> Complete web infrastructure for AI agents that need reliable, scalable web access. Production-ready APIs for enterprise-scale web access.

<Card title="Building an AI startup?" cta="Learn more" href="https://brightdata.com/ai/ai-startups-program" icon="rocket-launch" iconType="duotone" arrow="true">
  You might be eligible for our Startup Program. Get fully funded access to the infrastructure you're reading about right now (up to \$20K value).
</Card>

# Agent Web Access

Complete web infrastructure for AI agents that need reliable, scalable web access.

Build AI agents that automatically enrich data, conduct competitive intelligence research, and evaluate model outputs. Production-ready APIs for enterprise-scale web access.

<CardGroup cols={2}>
  <Card title="Get Started" icon="rocket" href="#architecture-patterns">
    Learn how to architect web access for AI agents
  </Card>

  <Card title="Product Selection" icon="list" href="#product-selection-guide">
    Choose the right products for your use case
  </Card>
</CardGroup>

***

## Scalability and Performance

Scale from simple search-and-extract workflows (thousands of leads simultaneously) to complex multi-step research operations (browser automation, session management, historical data access).

With 99.99% uptime and sub-second response times, you can focus on building your AI agents while we handle the web access complexity.

<CardGroup cols={3}>
  <Card title="99.99% Uptime" icon="shield-check">
    Enterprise-grade reliability ensures your AI agents never miss critical data
  </Card>

  <Card title="Sub-Second Response Times" icon="bolt">
    Lightning-fast web access keeps your agents responsive and efficient
  </Card>

  <Card title="Concurrent Operations" icon="server">
    Handle thousands of simultaneous operations with enterprise-scale infrastructure
  </Card>
</CardGroup>

***

## AI Agent Specific Features

Built for AI agent patterns, including:

* **Automatic CAPTCHA solving** - Never get blocked by CAPTCHAs or bot detection
* **Enterprise-scale concurrent operations** - Handle production workloads with confidence
* **Integrated proxy management** - Automatic IP rotation and session management
* **Browser automation** - Complex interactions with JavaScript-heavy sites
* **Historical data access** - Access archived web content for comprehensive research
* **Real-time search results** - Get fresh search data for discovery workflows

***

## Architecture Patterns

<CardGroup cols={2}>
  <Card title="Search and Extract" icon="magnifying-glass" href="/scraping-automation/serp-api/introduction">
    Use SERP API to discover and extract data from search results
  </Card>

  <Card title="Browser Automation" icon="browser" href="/scraping-automation/scraping-browser/introduction">
    Use Browser API for complex JavaScript-heavy interactions
  </Card>

  <Card title="CAPTCHA Solving" icon="unlock" href="/scraping-automation/web-unlocker/introduction">
    Use Web Unlocker to automatically bypass CAPTCHAs and blocks
  </Card>

  <Card title="Historical Data" icon="archive" href="/datasets/archive/overview">
    Access archived web content for comprehensive research
  </Card>
</CardGroup>

***

## Product Selection Guide

Choose the right products for your AI agent use case:

### Discovery and Search

* **SERP API** - Real-time search results for agent discovery
* **Web Archive** - Historical data access for comprehensive research

### Data Extraction

* **Web Scraper API** - Structured data extraction from popular domains
* **Browser API** - Complex interactions with JavaScript-heavy sites

### Reliability and Scale

* **Web Unlocker** - Automatic CAPTCHA solving and block bypass
* **Residential Proxies** - Real user IPs for maximum reliability

***

## Scaling Considerations

<CardGroup cols={2}>
  <Card title="Rate Limits" icon="clock" href="/general/usage-monitoring/fair_use_allowance">
    Understand rate limits and best practices for high-volume usage
  </Card>

  <Card title="Error Handling" icon="exclamation-triangle" href="/proxy-networks/errorCatalog">
    Implement robust error handling for production workloads
  </Card>

  <Card title="Session Management" icon="key" href="/proxy-networks/residential/configure-your-proxy">
    Manage sessions for maintaining state across requests
  </Card>

  <Card title="Monitoring" icon="chart-line" href="/general/usage-monitoring/Usage">
    Monitor usage and performance to optimize your workflows
  </Card>
</CardGroup>

***

## Examples

### Simple Search and Extract

Extract search results for competitive intelligence:

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
      keyword: 'competitor analysis',
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
      'keyword': 'competitor analysis',
      'country': 'US'
    }]
  )
  ```
</CodeGroup>

### Browser Automation

Automate complex interactions with JavaScript-heavy sites:

<CodeGroup>
  ```javascript Node.js theme={null}
  const response = await fetch('https://api.brightdata.com/browser_api/v1/run', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: 'https://example.com',
      browser: {
        headless: false,
        viewport: { width: 1920, height: 1080 }
      },
      actions: [
        { type: 'click', selector: '#button' },
        { type: 'wait', timeout: 2000 },
        { type: 'extract', selector: '.content' }
      ]
    })
  });
  ```

  ```python Python theme={null}
  import requests

  response = requests.post(
    'https://api.brightdata.com/browser_api/v1/run',
    headers={
      'Authorization': f'Bearer {api_key}',
      'Content-Type': 'application/json'
    },
    json={
      'url': 'https://example.com',
      'browser': {
        'headless': False,
        'viewport': {'width': 1920, 'height': 1080}
      },
      'actions': [
        {'type': 'click', 'selector': '#button'},
        {'type': 'wait', 'timeout': 2000},
        {'type': 'extract', 'selector': '.content'}
      ]
    }
  )
  ```
</CodeGroup>

***

## Next Steps

<CardGroup cols={2}>
  <Card title="SERP API Quickstart" icon="rocket" href="/search-api-quickstart">
    Start collecting search results for your AI agents
  </Card>

  <Card title="Browser API Quickstart" icon="rocket" href="/browser-api-quickstart">
    Automate browser interactions for complex workflows
  </Card>

  <Card title="Web Unlocker Quickstart" icon="rocket" href="/unlocker-api-quickstart">
    Bypass CAPTCHAs and blocks automatically
  </Card>

  <Card title="Browse Examples" icon="code" href="/scraping-automation/serp-api/get-top-100-google-results">
    Explore code examples and use cases
  </Card>
</CardGroup>

<Info>
  **Need help?** Check out our [API Reference](/api-reference/authentication) or [contact support](https://brightdata.com/contact).
</Info>