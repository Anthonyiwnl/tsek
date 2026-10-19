import './App.css'

const steps = [
  {
    title: 'Choose a service',
    description: 'Find the barangay service you want to apply for.',
  },
  {
    title: 'Prepare your documents',
    description: 'Keep the requirements for your application in one place.',
  },
  {
    title: 'Review before you apply',
    description: 'Check your documents before visiting your barangay.',
  },
]

function App() {
  return (
    <div className="page">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="TSEK home">
          <span aria-hidden="true">✓</span> TSEK
        </a>
        <span className="badge">Project preview</span>
      </header>
      <main id="home">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">A little preparation. A smoother application.</p>
          <h1 id="hero-title">
            Your documents.
            <br />
            <span>One step closer.</span>
          </h1>
          <p className="intro">
            TSEK is being built to help Filipino citizens organize and check
            documentary requirements before applying for barangay services.
          </p>
          <a className="button" href="#how-it-works">
            Explore how it works <span aria-hidden="true">↗</span>
          </a>
          <p className="notice">Coming soon: document uploads and AI-assisted checks.</p>
        </section>
        <section id="how-it-works" className="workflow" aria-labelledby="workflow-title">
          <p className="eyebrow">The plan</p>
          <h2 id="workflow-title">Less guesswork. More preparation.</h2>
          <div className="steps">
            {steps.map((step, index) => (
              <article className="step" key={step.title}>
                <span className="step-number">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer>
        TSEK · Smart Document Verification and Requirements Checker
        <span>Student project · In development</span>
      </footer>
    </div>
  )
}

export default App
