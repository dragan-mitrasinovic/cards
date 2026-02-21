import { Routes } from '@angular/router';
import { HomeComponent } from './home/home';
import { GameComponent } from './game/game';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'game/:id', component: GameComponent },
  { path: '**', redirectTo: '' },
];
