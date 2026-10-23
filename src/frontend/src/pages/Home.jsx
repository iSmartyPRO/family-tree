import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Collapse } from 'antd';
import PublicLayout from '../layouts/PublicLayout';
import { MenuIcon } from '../components/icons/menuIcons';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { useSettings } from '../context/SettingsContext';
import { can } from '../lib/access';

/*
 * The landing page: a one-page skeleton for the product (Settings → Site access
 * → Home page = «Landing»). Every text lives in locales/<lang>/landing.js —
 * replace them for a new project; the product name and description come from
 * Settings → General. Sections are anchors (#features, #how, #faq, #contact),
 * so the in-page menu and links from elsewhere jump straight to them.
 */

const SECTIONS = ['features', 'how', 'faq', 'contact'];

function Hero({ landing, settings, user, t }) {
  return (
    <section className="lp-hero" id="top">
      <div className="lp-hero__glow" aria-hidden />
      <p className="lp-kicker">{t('landing.kicker')}</p>
      <h1 className="lp-hero__title">{settings?.appName || t('brand')}</h1>
      <p className="lp-hero__lead">{settings?.appDescription || t('landing.title')}</p>
      <p className="lp-hero__sub">{t('landing.subtitle')}</p>
      <div className="lp-hero__cta">
        {user ? (
          <>
            <Link className="btn btn--primary" to="/account">
              {t('landing.ctaAccount')}
            </Link>
            {can(user, 'console.access') && (
              <Link className="btn btn--ghost" to="/admin">
                {t('landing.ctaAdmin')}
              </Link>
            )}
          </>
        ) : (
          <Link className="btn btn--primary" to="/login">
            {t('landing.ctaLogin')}
          </Link>
        )}
        <a className="btn btn--ghost" href="#features">
          {t('landing.ctaMore')}
        </a>
      </div>
      <ul className="lp-hero__facts">
        {landing.facts.map((fact) => (
          <li key={fact.label}>
            <strong>{fact.value}</strong>
            <span>{fact.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHead({ id, t }) {
  return (
    <header className="lp-section__head">
      <p className="lp-kicker">{t(`landing.${id}.kicker`)}</p>
      <h2>{t(`landing.${id}.title`)}</h2>
      <p className="lp-section__lead">{t(`landing.${id}.lead`)}</p>
    </header>
  );
}

export default function Home() {
  const { t, dict } = useLocale();
  const { user } = useAuth();
  const { settings } = useSettings();
  const { hash } = useLocation();
  const landing = dict.landing;

  // A link to /#faq opens the page before its sections exist (lazy page, texts loading): scroll once they do.
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1));
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <PublicLayout>
      <div className="lp">
        <nav className="lp-nav" aria-label={t('landing.navLabel')}>
          {SECTIONS.map((id) => (
            <a key={id} href={`#${id}`}>
              {t(`landing.nav.${id}`)}
            </a>
          ))}
        </nav>

        <Hero landing={landing} settings={settings} user={user} t={t} />

        <section className="lp-section" id="features">
          <SectionHead id="features" t={t} />
          <div className="lp-grid">
            {landing.features.items.map((item) => (
              <article className="lp-card" key={item.title}>
                <span className="lp-card__icon">
                  <MenuIcon name={item.icon} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section" id="how">
          <SectionHead id="how" t={t} />
          <ol className="lp-steps">
            {landing.how.steps.map((step, index) => (
              <li key={step.title}>
                <span className="lp-steps__num">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section" id="faq">
          <SectionHead id="faq" t={t} />
          <Collapse
            className="lp-faq"
            bordered={false}
            items={landing.faq.items.map((item, index) => ({ key: String(index), label: item.q, children: <p>{item.a}</p> }))}
          />
        </section>

        <section className="lp-section lp-contact" id="contact">
          <div>
            <h2>{t('landing.contact.title')}</h2>
            <p>{t('landing.contact.text')}</p>
          </div>
          <div className="lp-contact__actions">
            <Link className="btn btn--primary" to={user ? '/account' : '/login'}>
              {user ? t('landing.ctaAccount') : t('landing.contact.cta')}
            </Link>
            {landing.contact.email && (
              <a className="btn btn--ghost" href={`mailto:${landing.contact.email}`}>
                {landing.contact.email}
              </a>
            )}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
