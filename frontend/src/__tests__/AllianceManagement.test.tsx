/**
 * Alliance Management Component Tests
 * Comprehensive testing for alliance system functionality
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllianceManagement } from '../components/AllianceManagement';
import { AllianceService } from '../services/AllianceService';

// Mock the AllianceService
jest.mock('../services/AllianceService');
const mockAllianceService = AllianceService as jest.Mocked<typeof AllianceService>;

// Mock kingdom data
const mockKingdom = {
  id: 'kingdom-1',
  name: 'Test Kingdom',
  race: 'Human',
  resources: { gold: 1000, population: 500, land: 100, turns: 50 },
  stats: {},
  totalUnits: {},
  isActive: true,
  isOnline: false,
  allianceId: null,
  createdAt: new Date().toISOString(),
  lastActive: new Date().toISOString(),
};

const mockAlliance = {
  id: 'alliance-1',
  name: 'Test Alliance',
  description: 'A test alliance',
  tag: 'TEST',
  leaderId: 'user-1',
  leaderName: 'Test Leader',
  isPublic: true,
  maxMembers: 20,
  memberCount: 5,
  totalPower: 10000,
  createdAt: new Date().toISOString(),
};

describe('AllianceManagement', () => {
  const mockOnBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockAllianceService.getPublicAlliances.mockResolvedValue([mockAlliance]);
    mockAllianceService.getAllianceMessages.mockResolvedValue([]);
    mockAllianceService.subscribeToAllianceMessages.mockReturnValue({
      unsubscribe: jest.fn(),
    });
    mockAllianceService.subscribeToInvitations.mockReturnValue({
      unsubscribe: jest.fn(),
    });
  });

  it('renders alliance management interface', () => {
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    expect(screen.getByText('🤝 Alliance Management')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Browse Alliances')).toBeInTheDocument();
    expect(screen.getByText('Create Alliance')).toBeInTheDocument();
  });

  it('shows no alliance message when kingdom is not in alliance', () => {
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    expect(screen.getByText('You are not in an alliance')).toBeInTheDocument();
    expect(screen.getByText('Alliance Benefits:')).toBeInTheDocument();
  });

  it('displays alliance benefits list', () => {
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    expect(screen.getByText('🛡️ Mutual defense pacts')).toBeInTheDocument();
    expect(screen.getByText('💬 Real-time alliance chat')).toBeInTheDocument();
    expect(screen.getByText('⚔️ Coordinated warfare')).toBeInTheDocument();
  });

  it('navigates between different views', async () => {
    const user = userEvent.setup();
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    // Navigate to Browse Alliances
    await user.click(screen.getByText('Browse Alliances'));
    await waitFor(() => {
      expect(screen.getByText('Public Alliances')).toBeInTheDocument();
    });

    // Navigate to Create Alliance
    await user.click(screen.getByText('Create Alliance'));
    expect(screen.getByText('Create New Alliance')).toBeInTheDocument();
  });

  it('displays public alliances in browse view', async () => {
    const user = userEvent.setup();
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    await user.click(screen.getByText('Browse Alliances'));
    
    await waitFor(() => {
      expect(screen.getByText('[TEST] Test Alliance')).toBeInTheDocument();
      expect(screen.getByText('5/20')).toBeInTheDocument();
      expect(screen.getByText('Power: 10,000')).toBeInTheDocument();
    });
  });

  it('handles alliance creation form submission', async () => {
    const user = userEvent.setup();
    mockAllianceService.createAlliance.mockResolvedValue(mockAlliance);
    
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    await user.click(screen.getByText('Create Alliance'));
    
    // Fill out the form
    await user.type(screen.getByLabelText('Alliance Name'), 'New Alliance');
    await user.type(screen.getByLabelText(/Alliance Tag/), 'NEW');
    await user.type(screen.getByLabelText(/Description/), 'A new test alliance');
    
    // Submit the form
    await user.click(screen.getByText('Create Alliance'));
    
    await waitFor(() => {
      expect(mockAllianceService.createAlliance).toHaveBeenCalledWith({
        name: 'New Alliance',
        tag: 'NEW',
        description: 'A new test alliance',
      });
    });
  });

  it('validates alliance creation form', async () => {
    const user = userEvent.setup();
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    await user.click(screen.getByText('Create Alliance'));
    
    // Try to submit empty form
    const submitButton = screen.getByText('Create Alliance');
    await user.click(submitButton);
    
    // Form should not submit without required fields
    expect(mockAllianceService.createAlliance).not.toHaveBeenCalled();
  });

  it('handles join alliance action', async () => {
    const user = userEvent.setup();
    mockAllianceService.joinAlliance.mockResolvedValue();
    
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    await user.click(screen.getByText('Browse Alliances'));
    
    await waitFor(() => {
      const joinButton = screen.getByText('Join Alliance');
      expect(joinButton).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('Join Alliance'));
    
    await waitFor(() => {
      expect(mockAllianceService.joinAlliance).toHaveBeenCalledWith(
        mockAlliance.id,
        mockKingdom.id
      );
    });
  });

  it('shows alliance chat when kingdom is in alliance', () => {
    const kingdomInAlliance = { ...mockKingdom, allianceId: 'alliance-1' };
    render(<AllianceManagement kingdom={kingdomInAlliance} onBack={mockOnBack} />);
    
    expect(screen.getByText('Alliance Chat')).toBeInTheDocument();
  });

  it('handles chat message sending', async () => {
    const user = userEvent.setup();
    const kingdomInAlliance = { ...mockKingdom, allianceId: 'alliance-1' };
    mockAllianceService.sendAllianceMessage.mockResolvedValue({
      id: 'msg-1',
      allianceId: 'alliance-1',
      senderId: 'user-1',
      senderName: 'Test User',
      content: 'Test message',
      messageType: 'CHAT',
      createdAt: new Date().toISOString(),
    });
    
    render(<AllianceManagement kingdom={kingdomInAlliance} onBack={mockOnBack} />);
    
    await user.click(screen.getByText('Alliance Chat'));
    
    const messageInput = screen.getByPlaceholderText('Type your message...');
    await user.type(messageInput, 'Hello alliance!');
    
    await user.click(screen.getByText('Send'));
    
    await waitFor(() => {
      expect(mockAllianceService.sendAllianceMessage).toHaveBeenCalledWith({
        allianceId: 'alliance-1',
        content: 'Hello alliance!',
      });
    });
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    await user.click(screen.getByText('← Back to Kingdom'));
    
    expect(mockOnBack).toHaveBeenCalled();
  });

  it('handles loading states appropriately', () => {
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    // Should show loading initially for alliances
    expect(screen.getByText('Loading alliances...')).toBeInTheDocument();
  });

  it('supports keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    // Tab through navigation buttons
    await user.tab();
    expect(screen.getByText('← Back to Kingdom')).toHaveFocus();
    
    await user.tab();
    expect(screen.getByText('Overview')).toHaveFocus();
  });

  it('displays alliance member count and power correctly', async () => {
    const user = userEvent.setup();
    render(<AllianceManagement kingdom={mockKingdom} onBack={mockOnBack} />);
    
    await user.click(screen.getByText('Browse Alliances'));
    
    await waitFor(() => {
      expect(screen.getByText('5/20')).toBeInTheDocument();
      expect(screen.getByText('Power: 10,000')).toBeInTheDocument();
      expect(screen.getByText('Leader: Test Leader')).toBeInTheDocument();
    });
  });
});
