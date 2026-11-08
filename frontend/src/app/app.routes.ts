import { Routes } from '@angular/router';
import { Login } from './login';
import {
  Layout,
  MyLeaves,
  Approvals,
  TeamCalendar,
  Admin
} from './pages';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Layout,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'leaves', component: MyLeaves },
      { path: 'approvals', component: Approvals },
      { path: 'calendar', component: TeamCalendar },
      { path: 'admin', component: Admin }
    ]
  },
  { path: '**', redirectTo: 'login' }
];