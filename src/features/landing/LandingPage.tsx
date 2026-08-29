import "./LandingPage.css";

const heroImage =
  "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=2000&q=85";

const fleetImage =
  "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=2000&q=85";

export default function EvoraLanding() {
  return (
    <div className="evora">

      {/* ================= NAVBAR ================= */}

      <header className="navbar">
        <a href="#" className="logo">
          EVORA<span>®</span>
        </a>

        <nav>
          <a href="#platform">Platform</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#impact">Impact</a>
        </nav>

        <div className="nav-actions">
          <a href="#" className="login">
            Login
          </a>

          <a href="#" className="nav-cta">
            Enter EVORA
          </a>
        </div>
      </header>


      {/* ================= HERO ================= */}

      <section className="hero">

        <div className="hero-content fade-up">

          <p className="eyebrow">
            ENTERPRISE FLEET ELECTRIFICATION
          </p>

          <h1>
            Make the move to
            <span>electric smarter.</span>
          </h1>

          <p className="hero-text">
            EVORA helps enterprises understand their fleet,
            plan their transition to electric vehicles, and
            operate smarter every day.
          </p>

          <div className="hero-buttons">

            <a href="#" className="button primary">
              Explore EVORA
              <span>→</span>
            </a>

            <a href="#how-it-works" className="button secondary">
              Learn how it works
            </a>

          </div>

        </div>


        <div className="hero-image-container fade-in">

          <img
            src={heroImage}
            alt="Electric vehicle fleet"
          />

          <div className="image-caption">
            <span>EVORA</span>
            <span>Intelligence for electric fleets</span>
          </div>

        </div>

      </section>


      {/* ================= INTRO ================= */}

      <section className="intro section" id="platform">

        <div className="section-heading reveal">

          <p className="eyebrow">
            WHY EVORA
          </p>

          <h2>
            Electrification is more than
            choosing an electric vehicle.
          </h2>

        </div>

        <div className="intro-text reveal">

          <p>
            A successful transition requires understanding
            your vehicles, routes, energy needs, charging
            infrastructure and operational requirements.
          </p>

          <p>
            EVORA brings these elements together into one
            connected platform, helping organizations make
            confident, data-driven decisions.
          </p>

        </div>

      </section>


      {/* ================= HOW IT WORKS ================= */}

      <section
        className="how-it-works section"
        id="how-it-works"
      >

        <div className="section-top reveal">

          <div>
            <p className="eyebrow">
              HOW IT WORKS
            </p>

            <h2>
              From fleet data
              <br />
              to better decisions.
            </h2>
          </div>

          <p>
            EVORA connects the key parts of fleet
            electrification into one simple workflow.
          </p>

        </div>


        <div className="steps">

          <div className="step reveal">

            <span className="step-number">
              01
            </span>

            <h3>
              Understand
            </h3>

            <p>
              Understand how your fleet operates,
              including vehicle usage, routes,
              costs and energy requirements.
            </p>

          </div>


          <div className="step reveal">

            <span className="step-number">
              02
            </span>

            <h3>
              Assess
            </h3>

            <p>
              Identify which vehicles and routes
              are ready for electrification and
              where challenges may exist.
            </p>

          </div>


          <div className="step reveal">

            <span className="step-number">
              03
            </span>

            <h3>
              Plan
            </h3>

            <p>
              Build a practical transition strategy
              across vehicles, charging and
              infrastructure.
            </p>

          </div>


          <div className="step reveal">

            <span className="step-number">
              04
            </span>

            <h3>
              Operate
            </h3>

            <p>
              Continuously improve your electric
              fleet as operations, vehicles and
              energy needs change.
            </p>

          </div>

        </div>

      </section>


      {/* ================= IMAGE SECTION ================= */}

      <section className="image-section">

        <div className="large-image reveal">

          <img
            src={fleetImage}
            alt="Electric vehicle"
          />

        </div>

        <div className="image-section-content reveal">

          <p className="eyebrow">
            ONE CONNECTED PLATFORM
          </p>

          <h2>
            See your fleet
            <span>as a whole.</span>
          </h2>

          <p>
            EVORA connects vehicles, routes, batteries,
            charging and energy data so your team can
            understand the bigger picture.
          </p>

          <a href="#" className="simple-link">
            Discover the platform →
          </a>

        </div>

      </section>


      {/* ================= INTELLIGENCE ================= */}

      <section className="intelligence section">

        <div className="section-heading center reveal">

          <p className="eyebrow">
            BUILT FOR BETTER DECISIONS
          </p>

          <h2>
            Intelligence that works
            for your fleet.
          </h2>

          <p>
            Turn complex fleet data into clear,
            actionable insights.
          </p>

        </div>


        <div className="feature-grid">

          <div className="feature reveal">
            <div className="feature-icon">
              01
            </div>

            <h3>
              Fleet Intelligence
            </h3>

            <p>
              Understand fleet performance,
              utilization and operational patterns.
            </p>
          </div>


          <div className="feature reveal">
            <div className="feature-icon">
              02
            </div>

            <h3>
              EV Readiness
            </h3>

            <p>
              Know which vehicles and routes
              are suitable for electrification.
            </p>
          </div>


          <div className="feature reveal">
            <div className="feature-icon">
              03
            </div>

            <h3>
              Migration Planning
            </h3>

            <p>
              Create a practical roadmap for
              transitioning your fleet.
            </p>
          </div>


          <div className="feature reveal">
            <div className="feature-icon">
              04
            </div>

            <h3>
              Smart Operations
            </h3>

            <p>
              Keep improving fleet performance
              after the transition to EVs.
            </p>
          </div>

        </div>

      </section>


      {/* ================= IMPACT ================= */}

      <section className="impact" id="impact">

        <div className="impact-content reveal">

          <p className="eyebrow">
            THE EVORA DIFFERENCE
          </p>

          <h2>
            A clearer path
            to electric.
          </h2>

          <p>
            Move from uncertainty to informed action
            with one platform built around the realities
            of enterprise fleet operations.
          </p>

        </div>


        <div className="stats">

          <div className="stat reveal">
            <strong>01</strong>
            <span>
              Connected fleet intelligence
            </span>
          </div>

          <div className="stat reveal">
            <strong>02</strong>
            <span>
              Data-driven electrification
            </span>
          </div>

          <div className="stat reveal">
            <strong>03</strong>
            <span>
              Smarter fleet operations
            </span>
          </div>

        </div>

      </section>


      {/* ================= CTA ================= */}

      <section className="cta">

        <div className="cta-inner reveal">

          <p className="eyebrow">
            READY TO GET STARTED?
          </p>

          <h2>
            Build a smarter
            <span>electric fleet.</span>
          </h2>

          <p>
            Discover how EVORA can help your
            organization move forward.
          </p>

          <a href="#" className="button primary">
            Enter EVORA
            <span>→</span>
          </a>

        </div>

      </section>


      {/* ================= FOOTER ================= */}

      <footer>

        <div className="footer-brand">

          <a href="#" className="logo dark">
            EVORA<span>®</span>
          </a>

          <p>
            The intelligence layer for
            electric fleets.
          </p>

        </div>


        <div className="footer-links">

          <a href="#platform">
            Platform
          </a>

          <a href="#how-it-works">
            How It Works
          </a>

          <a href="#impact">
            Impact
          </a>

          <a href="#">
            Login
          </a>

        </div>


        <p className="copyright">
          © 2026 EVORA. All rights reserved.
        </p>

      </footer>

    </div>
  );
}