import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { EventSchedulerPage } from '../../src/pages/dashboard/EventSchedulerPage';
import '../../src/index.css';

createRoot(document.getElementById('root')!).render(<BrowserRouter><EventSchedulerPage /></BrowserRouter>);
