import { Suspense, lazy } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Result, Spin } from 'antd';
import Chrome from '../../components/Chrome';
import { useLocale } from '../../context/LocaleContext';
import { errorMessage } from '../../lib/errors';
import { FamilyProvider, useFamily } from './FamilyContext';
import '../shared/module.css';
import './family.css';

const TreeList = lazy(() => import('./pages/TreeList'));
const TreeView = lazy(() => import('./pages/TreeView'));

function Shell() {
  const { t } = useLocale();
  const { config, error } = useFamily();
  if (error) {
    const status = error?.response?.status;
    return (
      <Result
        status={status === 404 ? '404' : 'warning'}
        title={status === 404 ? t('family.disabled') : errorMessage(error)}
        extra={<Link to="/apps">{t('apps.title')}</Link>}
      />
    );
  }
  if (!config) {
    return (
      <div className="boot-screen">
        <Spin size="large" />
      </div>
    );
  }
  return (
    <main className="fam-shell">
      <Suspense
        fallback={
          <div className="page-fallback">
            <Spin />
          </div>
        }
      >
        <Routes>
          <Route index element={<TreeList />} />
          <Route path="t/:id" element={<TreeView />} />
          <Route path="*" element={<Navigate to="/app/family" replace />} />
        </Routes>
      </Suspense>
    </main>
  );
}

/** Family trees: /app/family (list) and /app/family/t/:id (the tree). */
export default function FamilyApp() {
  return (
    <div className="shell fam-root">
      <Chrome dense />
      <FamilyProvider>
        <Shell />
      </FamilyProvider>
    </div>
  );
}
