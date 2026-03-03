import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmoteBarComponent } from './emote-bar';

describe('EmoteBarComponent', () => {
  let fixture: ComponentFixture<EmoteBarComponent>;
  let component: EmoteBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmoteBarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(EmoteBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render toggle button initially', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent.trim()).toBe('💬');
  });

  it('should show emote options and cancel when toggle is clicked', () => {
    const toggle = fixture.nativeElement.querySelector('button');
    toggle.click();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(5);
    expect(buttons[0].textContent.trim()).toBe('Wow');
    expect(buttons[1].textContent.trim()).toBe('Well Played');
    expect(buttons[2].textContent.trim()).toBe('Interesting');
    expect(buttons[3].textContent.trim()).toBe('Cancel');
  });

  it('should emit emoteSent and close when an emote is clicked', () => {
    const spy = vi.fn();
    component.emoteSent.subscribe(spy);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith('Well Played');
    expect(component.open()).toBe(false);
  });
});
