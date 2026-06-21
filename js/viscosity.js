/**
 * Viscora Viscosity States Configuration
 */

export const ViscosityStates = {
    NORMAL: {
        id: 'NORMAL',
        name: 'NORMAL',
        color: '#10b981',        // Emerald Green
        colorSecondary: '#34d399',
        particleColor: 'rgba(16, 185, 129, 0.5)',
        accel: 0.28,             // Slower acceleration for better control
        maxSpeed: 3.1,           // Reduced from 3.8
        friction: 0.85,          
        jumpForce: -8.0,         // Reduced from -9.5
        gravity: 0.32,           // Reduced from 0.38
        squishiness: 0.12,       
        clingable: false,        
        drag: 0.98,
        glowColor: 'rgba(16, 185, 129, 0.4)'
    },
    LOW: {
        id: 'LOW',
        name: 'SIVI (DÜŞÜK)',
        color: '#06b6d4',        // Cyan / Aqua
        colorSecondary: '#22d3ee',
        particleColor: 'rgba(6, 182, 212, 0.5)',
        accel: 0.30,             // Reduced by 25% (from 0.40)
        maxSpeed: 4.13,          // Reduced by 25% (from 5.5)
        friction: 0.97,          
        jumpForce: -8.06,        // Reduced by 25% (from -10.75) to balance with double jump
        gravity: 0.27,           // Reduced from 0.24 (floaty but safe)
        squishiness: 0.22,       
        clingable: false,
        drag: 0.99,
        glowColor: 'rgba(6, 182, 212, 0.5)'
    },
    HIGH: {
        id: 'HIGH',
        name: 'JEL (YÜKSEK)',
        color: '#d946ef',        // Fuchsia / Purple
        colorSecondary: '#f472b6',
        particleColor: 'rgba(217, 70, 239, 0.5)',
        accel: 0.14,             // Reduced from 0.18
        maxSpeed: 3.4,           // Increased by 40% (from 2.4)
        friction: 0.55,          
        jumpForce: -6.7,         // Increased by 15% (from -5.8) to allow higher jumps
        gravity: 0.40,           // Reduced from 0.48
        squishiness: 0.05,       
        clingable: true,         
        drag: 0.92,
        glowColor: 'rgba(217, 70, 239, 0.5)'
    }
};

export const ViscosityList = [
    ViscosityStates.NORMAL,
    ViscosityStates.LOW,
    ViscosityStates.HIGH
];


