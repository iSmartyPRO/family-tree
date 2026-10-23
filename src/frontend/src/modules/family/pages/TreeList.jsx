import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Skeleton } from 'antd';
import { ApartmentOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import ModuleHeader from '../../shared/ModuleHeader';
import { useLocale } from '../../../context/LocaleContext';
import { fmtSmart } from '../../../lib/datetime';
import { useFamily } from '../FamilyContext';
import { TreeDialog } from '../components/Dialogs';
import PageTransition from '../../../components/ui/PageTransition';

function TreeCard({ tree, t }) {
  return (
    <Link to={`/app/family/t/${tree.id}`} className="fam-tree-card">
      <div className="fam-tree-card__art" aria-hidden="true">
        {tree.faces?.length ? (
          <div className="fam-faces">
            {tree.faces.map((url) => (
              <img key={url} src={url} alt="" loading="lazy" />
            ))}
          </div>
        ) : (
          <ApartmentOutlined />
        )}
      </div>
      <div className="fam-tree-card__body">
        <h3>{tree.name}</h3>
        {tree.description && <p>{tree.description}</p>}
        <div className="fam-tree-card__meta">
          <span>
            <TeamOutlined /> {t('family.peopleCount', { count: tree.personCount })}
          </span>
          <span>{t('family.updated', { when: fmtSmart(tree.updatedAt) })}</span>
          {tree.level !== 'manage' && <span className="fam-chip">{t(`family.levelName.${tree.level}`)}</span>}
        </div>
      </div>
    </Link>
  );
}

/** The trees this person can see, and a way to start a new one. */
export default function TreeList() {
  const { t } = useLocale();
  const navigate = useNavigate();
  const { trees, reload } = useFamily();
  const [creating, setCreating] = useState(false);

  return (
    <PageTransition>
      <div className="fam-list">
        <ModuleHeader
          crumbs={null}
          icon={<ApartmentOutlined />}
          title={t('apps.family.name')}
          description={t('family.lead')}
          actions={[{ key: 'new', primary: true, icon: <PlusOutlined />, label: t('family.tree.new'), onClick: () => setCreating(true), tour: 'family.newTree' }]}
        />
        {!trees ? (
          <div className="fam-grid">
            {[0, 1, 2].map((i) => (
              <Skeleton.Node key={i} active style={{ width: '100%', height: 220 }} />
            ))}
          </div>
        ) : trees.length ? (
          <div className="fam-grid" data-tour="family.trees">
            {trees.map((tree) => (
              <TreeCard key={tree.id} tree={tree} t={t} />
            ))}
            <button type="button" className="fam-tree-card fam-tree-card--new" onClick={() => setCreating(true)}>
              <PlusOutlined />
              <span>{t('family.tree.new')}</span>
            </button>
          </div>
        ) : (
          <div className="fam-empty fam-empty--page">
            <div className="fam-empty__art" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <h2>{t('family.noTrees.title')}</h2>
            <p>{t('family.noTrees.text')}</p>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
              {t('family.tree.new')}
            </Button>
          </div>
        )}
        <TreeDialog
          open={creating}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            reload();
            navigate(`/app/family/t/${id}`);
          }}
        />
      </div>
    </PageTransition>
  );
}
