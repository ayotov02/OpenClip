> ## Documentation Index
> Fetch the complete documentation index at: https://docs.brightdata.com/llms.txt
> Use this file to discover all available pages before exploring further.

# LLM Grounding & Evaluation

> Build AI systems that fact-check model outputs, validate training data, and ground language models in real-world information. Create evaluation workflows that test model accuracy against live web data.

<Card title="Building an AI startup?" cta="Learn more" href="https://brightdata.com/ai/ai-startups-program" icon="rocket-launch" iconType="duotone" arrow="true">
  You might be eligible for our Startup Program. Get fully funded access to the infrastructure you're reading about right now (up to \$20K value).
</Card>

# LLM Grounding & Evaluation

Build AI systems that fact-check model outputs, validate training data, and ground language models in real-world information.

Create evaluation workflows that test model accuracy against live web data, verify claims through multi-source validation, and maintain model reliability through continuous real-world grounding.

<CardGroup cols={2}>
  <Card title="Learn Fact-Checking" icon="lightbulb" href="#fact-checking-workflows">
    Understand fact-checking workflows
  </Card>

  <Card title="Get Started" icon="rocket" href="#model-output-validation">
    Start validating model outputs
  </Card>
</CardGroup>

***

## Challenges Addressed

Handle the unique challenges of AI evaluation at scale:

* **Real-time fact verification** - Requiring fast web access for immediate validation
* **Comprehensive testing** - Demanding broad source coverage for thorough evaluation
* **Historical validation** - Needing archive access for fact-checking historical claims
* **Continuous evaluation** - Requiring reliable infrastructure that never goes down

From simple fact-checking to comprehensive model evaluation frameworks, grounding systems need infrastructure that provides both speed and reliability.

<CardGroup cols={2}>
  <Card title="Fast Web Access" icon="bolt" href="/scraping-automation/serp-api/introduction">
    Real-time fact verification with sub-second response times
  </Card>

  <Card title="Broad Source Coverage" icon="globe" href="/datasets/deep-lookup/overview">
    Comprehensive testing across multiple sources
  </Card>

  <Card title="Historical Validation" icon="archive" href="/datasets/archive/overview">
    Access historical data for fact-checking past claims
  </Card>

  <Card title="Reliable Infrastructure" icon="shield-check">
    99.99% uptime ensures continuous evaluation never stops
  </Card>
</CardGroup>

***

## Goal

Built for evaluation patterns that maintain model accuracy and user trust through rigorous real-world validation.

***

## Fact-Checking Workflows

Verify claims against real-world data:

<Steps>
  <Step title="Extract Claims from Model Output">
    Extract factual claims from model outputs that need verification.

    ```json  theme={null}
    {
      "claims": [
        {
          "text": "The company was founded in 2020",
          "entity": "company_name",
          "type": "factual"
        }
      ]
    }
    ```
  </Step>

  <Step title="Search for Verification">
    Search for verification across multiple sources:

    * Real-time search results (SERP API)
    * Historical data (Web Archive)
    * Structured data (Deep Lookup)

    <CodeGroup>
      ```javascript Node.js theme={null}
      async function verifyClaim(claim) {
        const searches = await Promise.all([
          searchSERP(claim.text),
          searchArchive(claim.entity, '2020-01-01'),
          searchDeepLookup(claim.entity)
        ]);
        
        return searches;
      }
      ```

      ```python Python theme={null}
      import asyncio

      async def verify_claim(claim):
          searches = await asyncio.gather(
              search_serp(claim['text']),
              search_archive(claim['entity'], '2020-01-01'),
              search_deep_lookup(claim['entity'])
          )
          
          return searches
      ```
    </CodeGroup>
  </Step>

  <Step title="Validate Against Sources">
    Validate claims against multiple sources and determine confidence.

    <Tip>
      Use cross-source validation to increase confidence in fact-checking results.
    </Tip>
  </Step>

  <Step title="Report Validation Results">
    Report validation results with source attribution and confidence scores.

    <Check>
      Validated claims are marked with confidence scores and source references.
    </Check>
  </Step>
</Steps>

***

## Model Output Validation

Validate model outputs in real-time:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function validateModelOutput(output, claims) {
    const validationPromises = claims.map(claim => 
      verifyClaim(claim)
    );
    
    const validationResults = await Promise.all(validationPromises);
    
    const validatedOutput = {
      original: output,
      claims: validationResults.map((result, index) => ({
        claim: claims[index],
        verified: result.confidence > 0.8,
        confidence: result.confidence,
        sources: result.sources
      }))
    };
    
    return validatedOutput;
  }
  ```

  ```python Python theme={null}
  import asyncio

  async def validate_model_output(output, claims):
      validation_tasks = [verify_claim(claim) for claim in claims]
      validation_results = await asyncio.gather(*validation_tasks)
      
      validated_output = {
          'original': output,
          'claims': [
              {
                  'claim': claim,
                  'verified': result['confidence'] > 0.8,
                  'confidence': result['confidence'],
                  'sources': result['sources']
              }
              for claim, result in zip(claims, validation_results)
          ]
      }
      
      return validated_output
  ```
</CodeGroup>

***

## Training Data Verification

Verify training data against real-world sources:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function verifyTrainingData(dataset) {
    const verificationResults = await Promise.all(
      dataset.map(item => verifyDataItem(item))
    );
    
    const verified = verificationResults.filter(r => r.verified);
    const unverified = verificationResults.filter(r => !r.verified);
    
    return {
      total: dataset.length,
      verified: verified.length,
      unverified: unverified.length,
      accuracy: verified.length / dataset.length,
      issues: unverified
    };
  }
  ```

  ```python Python theme={null}
  import asyncio

  async def verify_training_data(dataset):
      verification_tasks = [verify_data_item(item) for item in dataset]
      verification_results = await asyncio.gather(*verification_tasks)
      
      verified = [r for r in verification_results if r['verified']]
      unverified = [r for r in verification_results if not r['verified']]
      
      return {
          'total': len(dataset),
          'verified': len(verified),
          'unverified': len(unverified),
          'accuracy': len(verified) / len(dataset),
          'issues': unverified
      }
  ```
</CodeGroup>

***

## Historical Fact Validation with Archive

Validate historical claims using web archive:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function validateHistoricalFact(claim, date) {
    // Search archive for historical data
    const archiveResults = await searchArchive(claim.entity, date);
    
    // Compare with claim
    const matches = archiveResults.filter(result => 
      result.text.includes(claim.text)
    );
    
    return {
      claim,
      date,
      verified: matches.length > 0,
      confidence: matches.length / archiveResults.length,
      sources: matches
    };
  }
  ```

  ```python Python theme={null}
  import asyncio

  async def validate_historical_fact(claim, date):
      # Search archive for historical data
      archive_results = await search_archive(claim['entity'], date)
      
      # Compare with claim
      matches = [
          result for result in archive_results
          if claim['text'] in result['text']
      ]
      
      return {
          'claim': claim,
          'date': date,
          'verified': len(matches) > 0,
          'confidence': len(matches) / len(archive_results) if archive_results else 0,
          'sources': matches
      }
  ```
</CodeGroup>

***

## Multi-Source Cross-Referencing

Cross-reference facts across multiple sources:

<CodeGroup>
  ```javascript Node.js theme={null}
  async function crossReferenceFact(fact) {
    const sources = await Promise.all([
      searchSERP(fact.query),
      searchDeepLookup(fact.entity),
      searchArchive(fact.entity, fact.date),
      searchSite(fact.url)
    ]);
    
    // Find common findings across sources
    const commonFindings = findCommonFindings(sources);
    
    return {
      fact,
      sources: sources.length,
      commonFindings,
      confidence: commonFindings.length / sources.length,
      validated: commonFindings.length >= sources.length * 0.7
    };
  }
  ```

  ```python Python theme={null}
  import asyncio

  async def cross_reference_fact(fact):
      sources = await asyncio.gather(
          search_serp(fact['query']),
          search_deep_lookup(fact['entity']),
          search_archive(fact['entity'], fact['date']),
          search_site(fact['url'])
      )
      
      # Find common findings across sources
      common_findings = find_common_findings(sources)
      
      return {
          'fact': fact,
          'sources': len(sources),
          'common_findings': common_findings,
          'confidence': len(common_findings) / len(sources) if sources else 0,
          'validated': len(common_findings) >= len(sources) * 0.7
      }
  ```
</CodeGroup>

***

## Continuous Evaluation Systems

Build continuous evaluation systems for ongoing model validation:

<CardGroup cols={2}>
  <Card title="Real-Time Monitoring" icon="chart-line" href="/general/usage-monitoring/Usage">
    Monitor model outputs in real-time for continuous validation
  </Card>

  <Card title="Automated Testing" icon="robot" href="/scraping-automation/serp-api/introduction">
    Automate fact-checking workflows for continuous evaluation
  </Card>

  <Card title="Alert Systems" icon="bell" href="/general/webhook_notifications">
    Set up alerts for unverified claims or low confidence scores
  </Card>

  <Card title="Performance Tracking" icon="chart-bar" href="/general/usage-monitoring/fair_use_allowance">
    Track evaluation performance and model accuracy over time
  </Card>
</CardGroup>

***

## Templates

Use pre-built templates for common grounding workflows:

<CardGroup cols={2}>
  <Card title="Fact-Checking Template" icon="check-circle" href="/scraping-automation/serp-api/introduction">
    Template for real-time fact-checking workflows
  </Card>

  <Card title="Model Evaluation Template" icon="clipboard-check" href="/datasets/deep-lookup/overview">
    Template for comprehensive model evaluation
  </Card>

  <Card title="Training Data Validation" icon="database" href="/datasets/data-validation/data-validation-for-customers">
    Template for validating training datasets
  </Card>

  <Card title="Historical Validation" icon="archive" href="/datasets/archive/overview">
    Template for historical fact validation
  </Card>
</CardGroup>

***

## Next Steps

<CardGroup cols={2}>
  <Card title="SERP API Quickstart" icon="rocket" href="/search-api-quickstart">
    Start fact-checking with real-time search results
  </Card>

  <Card title="Deep Lookup Quickstart" icon="rocket" href="/deep-lookup-quickstart">
    Use Deep Lookup for comprehensive fact validation
  </Card>

  <Card title="Web Archive" icon="rocket" href="/datasets/archive/overview">
    Access historical data for fact-checking
  </Card>

  <Card title="Browse Examples" icon="code" href="/datasets/deep-lookup/code-examples">
    Explore grounding and evaluation examples
  </Card>
</CardGroup>

<Info>
  **Need help?** Check out our [Evaluation Examples](/datasets/deep-lookup/code-examples) or [contact support](https://brightdata.com/contact).
</Info>