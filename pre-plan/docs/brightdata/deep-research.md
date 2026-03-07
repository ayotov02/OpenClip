> ## Documentation Index
> Fetch the complete documentation index at: https://docs.brightdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Deep Research

> Build AI agents that conduct comprehensive, multi-source research operations at scale. Combine real-time search, historical analysis, and complex site navigation for competitive intelligence and market research.

<Card title="Building an AI startup?" cta="Learn more" href="https://brightdata.com/ai/ai-startups-program" icon="rocket-launch" iconType="duotone" arrow="true">
  You might be eligible for our Startup Program. Get fully funded access to the infrastructure you're reading about right now (up to \$20K value).
</Card>

# Deep Research Agents

Build AI agents that conduct comprehensive, multi-source research operations at scale.

Go beyond simple data extraction to create research workflows that combine real-time search, historical analysis, and complex site navigation. These capabilities form the foundation for competitive intelligence, market research, and investigative analysis systems.

<CardGroup cols={2}>
  <Card title="Learn Research Patterns" icon="lightbulb" href="#multi-source-research-patterns">
    Understand multi-source research workflows
  </Card>

  <Card title="Get Started" icon="rocket" href="#examples">
    Explore research examples
  </Card>
</CardGroup>

***

## Research Challenges Handled

Handle research challenges that typically stop basic scraping:

* **Multi-step workflows** - Require session persistence across multiple requests
* **Complex site interactions** - Demand browser automation for JavaScript-heavy sites
* **Historical context** - Need archive access for comprehensive research
* **Research depth** - Require cross-source validation for accuracy

The infrastructure provides a full toolkit for comprehensive research operations.

<CardGroup cols={2}>
  <Card title="Session Management" icon="key" href="/proxy-networks/residential/configure-your-proxy">
    Maintain session persistence across multi-step workflows
  </Card>

  <Card title="Browser Automation" icon="browser" href="/scraping-automation/scraping-browser/introduction">
    Handle complex site interactions with browser automation
  </Card>

  <Card title="Historical Data" icon="archive" href="/datasets/archive/overview">
    Access historical context through web archive
  </Card>

  <Card title="Cross-Source Validation" icon="check-circle" href="/datasets/deep-lookup/overview">
    Validate research across multiple sources
  </Card>
</CardGroup>

***

## Application and Purpose

From startup competitive analysis to enterprise market intelligence, research agents require infrastructure that can:

* Navigate complex workflows
* Maintain context across multiple sources
* Provide both current and historical perspectives

Built for research patterns that require both breadth and depth.

***

## Multi-Source Research Patterns

Combine multiple data sources for comprehensive research:

<CardGroup cols={2}>
  <Card title="Real-Time Search" icon="magnifying-glass" href="/scraping-automation/serp-api/introduction">
    Use SERP API for real-time search results across multiple search engines
  </Card>

  <Card title="Historical Analysis" icon="archive" href="/datasets/archive/overview">
    Access historical data through web archive for trend analysis
  </Card>

  <Card title="Site-Specific Data" icon="globe" href="/scraping-automation/scraping-browser/introduction">
    Extract data from specific sites using browser automation
  </Card>

  <Card title="Cross-Reference Validation" icon="check-circle" href="/datasets/deep-lookup/overview">
    Validate findings across multiple sources for accuracy
  </Card>
</CardGroup>

***

## Historical Context with Web Archive

Access historical data for comprehensive research:

<CodeGroup>
  ```javascript Node.js theme={null}
  // Search historical data
  const response = await fetch('https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_ARCHIVE_DATASET_ID', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{
      url: 'https://example.com',
      date: '2023-01-01',
      archive_type: 'web_archive'
    }])
  });
  ```

  ```python Python theme={null}
  import requests

  # Search historical data
  response = requests.post(
    'https://api.brightdata.com/datasets/v3/trigger?dataset_id=YOUR_ARCHIVE_DATASET_ID',
    headers={
      'Authorization': f'Bearer {api_key}',
      'Content-Type': 'application/json'
    },
    json=[{
      'url': 'https://example.com',
      'date': '2023-01-01',
      'archive_type': 'web_archive'
    }]
  )
  ```
</CodeGroup>

***

## Complex Site Navigation

Navigate complex sites with browser automation:

<CodeGroup>
  ```javascript Node.js theme={null}
  // Multi-step research workflow
  const response = await fetch('https://api.brightdata.com/browser_api/v1/run', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: 'https://example.com/research',
      browser: {
        headless: true,
        viewport: { width: 1920, height: 1080 }
      },
      actions: [
        { type: 'navigate', url: 'https://example.com/search' },
        { type: 'fill', selector: '#search', value: 'research topic' },
        { type: 'click', selector: '#submit' },
        { type: 'wait', timeout: 3000 },
        { type: 'extract', selector: '.results' },
        { type: 'navigate', url: 'https://example.com/details' },
        { type: 'extract', selector: '.content' }
      ]
    })
  });
  ```

  ```python Python theme={null}
  import requests

  # Multi-step research workflow
  response = requests.post(
    'https://api.brightdata.com/browser_api/v1/run',
    headers={
      'Authorization': f'Bearer {api_key}',
      'Content-Type': 'application/json'
    },
    json={
      'url': 'https://example.com/research',
      'browser': {
        'headless': True,
        'viewport': {'width': 1920, 'height': 1080}
      },
      'actions': [
        {'type': 'navigate', 'url': 'https://example.com/search'},
        {'type': 'fill', 'selector': '#search', 'value': 'research topic'},
        {'type': 'click', 'selector': '#submit'},
        {'type': 'wait', 'timeout': 3000},
        {'type': 'extract', 'selector': '.results'},
        {'type': 'navigate', 'url': 'https://example.com/details'},
        {'type': 'extract', 'selector': '.content'}
      ]
    }
  )
  ```
</CodeGroup>

***

## Research Workflow Orchestration

Orchestrate complex research workflows:

<Steps>
  <Step title="Define Research Query">
    Define your research query and objectives. Identify the questions you need to answer.

    ```json  theme={null}
    {
      "query": "Market analysis for AI tools",
      "objectives": [
        "Identify key competitors",
        "Analyze pricing strategies",
        "Review customer feedback"
      ]
    }
    ```
  </Step>

  <Step title="Search Multiple Sources">
    Search across multiple sources simultaneously:

    * Real-time search results (SERP API)
    * Historical data (Web Archive)
    * Site-specific data (Browser API)

    <CodeGroup>
      ```javascript Node.js theme={null}
      const searchPromises = [
        searchSERP(query),
        searchArchive(query),
        searchSite(query)
      ];
      const results = await Promise.all(searchPromises);
      ```

      ```python Python theme={null}
      import asyncio

      search_tasks = [
        search_serp(query),
        search_archive(query),
        search_site(query)
      ]
      results = await asyncio.gather(*search_tasks)
      ```
    </CodeGroup>
  </Step>

  <Step title="Extract and Structure">
    Extract relevant data from each source and structure it for analysis.

    <Tip>
      Use data validation to ensure data quality and consistency across sources.
    </Tip>
  </Step>

  <Step title="Cross-Reference and Validate">
    Cross-reference findings across multiple sources and validate for accuracy.

    <Check>
      Validated research findings are ready for analysis and reporting.
    </Check>
  </Step>

  <Step title="Generate Research Report">
    Compile findings into a comprehensive research report.

    <Info>
      Include source attribution and validation status for transparency.
    </Info>
  </Step>
</Steps>

***

## Cross-Source Data Validation

Validate research findings across multiple sources:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function validateResearch(findings, sources) {
    const validationResults = await Promise.all(
      findings.map(finding => 
        validateAgainstSources(finding, sources)
      )
    );
    
    return validationResults.filter(result => result.confidence > 0.8);
  }

  async function validateAgainstSources(finding, sources) {
    // Cross-reference finding across sources
    const matches = await Promise.all(
      sources.map(source => checkMatch(finding, source))
    );
    
    const confidence = matches.filter(m => m).length / sources.length;
    return { finding, confidence, sources: matches };
  }
  ```

  ```python Python theme={null}
  import asyncio

  async def validate_research(findings, sources):
      validation_results = await asyncio.gather(*[
          validate_against_sources(finding, sources)
          for finding in findings
      ])
      
      return [r for r in validation_results if r['confidence'] > 0.8]

  async def validate_against_sources(finding, sources):
      # Cross-reference finding across sources
      matches = await asyncio.gather(*[
          check_match(finding, source)
          for source in sources
      ])
      
      confidence = sum(matches) / len(sources)
      return {'finding': finding, 'confidence': confidence, 'sources': matches}
  ```
</CodeGroup>

***

## Enterprise Research Templates

Use pre-built templates for common research workflows:

<CardGroup cols={2}>
  <Card title="Competitive Intelligence" icon="chart-line" href="/datasets/scrapers/scrapers-library">
    Template for competitive analysis and market research
  </Card>

  <Card title="Market Analysis" icon="building" href="/datasets/deep-lookup/overview">
    Template for comprehensive market research
  </Card>

  <Card title="Investigator Research" icon="search" href="/scraping-automation/serp-api/introduction">
    Template for investigative research workflows
  </Card>

  <Card title="Trend Analysis" icon="trending-up" href="/datasets/archive/overview">
    Template for historical trend analysis
  </Card>
</CardGroup>

***

## Examples

### Competitive Intelligence Research

Research competitors across multiple sources:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function researchCompetitor(competitorName) {
    // Search real-time data
    const serpResults = await searchSERP(`${competitorName} pricing features`);
    
    // Search historical data
    const archiveResults = await searchArchive(competitorName, '2023-01-01');
    
    // Extract site-specific data
    const siteData = await extractFromSite(`https://${competitorName}.com`);
    
    // Cross-reference findings
    const validated = await validateResearch([
      ...serpResults,
      ...archiveResults,
      siteData
    ]);
    
    return {
      competitor: competitorName,
      findings: validated,
      sources: ['serp', 'archive', 'site']
    };
  }
  ```

  ```python Python theme={null}
  import asyncio

  async def research_competitor(competitor_name):
      # Search real-time data
      serp_results = await search_serp(f'{competitor_name} pricing features')
      
      # Search historical data
      archive_results = await search_archive(competitor_name, '2023-01-01')
      
      # Extract site-specific data
      site_data = await extract_from_site(f'https://{competitor_name}.com')
      
      # Cross-reference findings
      validated = await validate_research([
          *serp_results,
          *archive_results,
          site_data
      ])
      
      return {
          'competitor': competitor_name,
          'findings': validated,
          'sources': ['serp', 'archive', 'site']
      }
  ```
</CodeGroup>

### Market Research Workflow

Conduct comprehensive market research:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function conductMarketResearch(topic) {
    // Step 1: Search current trends
    const currentTrends = await searchSERP(`${topic} trends 2024`);
    
    // Step 2: Analyze historical trends
    const historicalTrends = await searchArchive(topic, '2020-01-01');
    
    // Step 3: Extract competitor data
    const competitors = await findCompetitors(topic);
    const competitorData = await Promise.all(
      competitors.map(c => researchCompetitor(c))
    );
    
    // Step 4: Validate and compile
    const researchReport = {
      topic,
      currentTrends,
      historicalTrends,
      competitors: competitorData,
      validated: true
    };
    
    return researchReport;
  }
  ```

  ```python Python theme={null}
  import asyncio

  async def conduct_market_research(topic):
      # Step 1: Search current trends
      current_trends = await search_serp(f'{topic} trends 2024')
      
      # Step 2: Analyze historical trends
      historical_trends = await search_archive(topic, '2020-01-01')
      
      # Step 3: Extract competitor data
      competitors = await find_competitors(topic)
      competitor_data = await asyncio.gather(*[
          research_competitor(c)
          for c in competitors
      ])
      
      # Step 4: Validate and compile
      research_report = {
          'topic': topic,
          'current_trends': current_trends,
          'historical_trends': historical_trends,
          'competitors': competitor_data,
          'validated': True
      }
      
      return research_report
  ```
</CodeGroup>

***

## Next Steps

<CardGroup cols={2}>
  <Card title="SERP API Quickstart" icon="rocket" href="/search-api-quickstart">
    Start collecting search results for research
  </Card>

  <Card title="Browser API Quickstart" icon="rocket" href="/browser-api-quickstart">
    Automate complex site navigation for research
  </Card>

  <Card title="Web Archive" icon="rocket" href="/datasets/archive/overview">
    Access historical data for trend analysis
  </Card>

  <Card title="Deep Lookup" icon="rocket" href="/datasets/deep-lookup/overview">
    Use Deep Lookup for comprehensive research
  </Card>
</CardGroup>

<Info>
  **Need help?** Check out our [Research Examples](/scraping-automation/serp-api/get-top-100-google-results) or [contact support](https://brightdata.com/contact).
</Info>